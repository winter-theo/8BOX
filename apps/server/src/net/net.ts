import {
  CLIENT_MESSAGE_TYPES,
  type ClientMessage,
  type ClientMessageType,
  encodeMessage,
  type GameConfig,
  type HelloMessage,
  isValidPlayerName,
  PROTOCOL_VERSION,
  parseClientMessage,
  type RejectReason,
  type ServerMessage,
} from '@8box/shared';
import type { Accounts } from '../accounts/Accounts';
import type { Account } from '../accounts/account';
import type { EventBus } from '../core/events';
import type { Logger } from '../core/module';
import type { Scheduler } from '../core/scheduler';
import { TokenBucket } from './rateLimit';
import { Session, type Transport } from './session';

/** WebSocket close codes. */
export const CloseCode = {
  normal: 1000,
  goingAway: 1001,
  policyViolation: 1008,
} as const;

/** Message types handled by modules once the player has joined. */
export type GameMessageType = Exclude<ClientMessageType, 'hello' | 'setName' | 'ping'>;
export type GameMessage<T extends GameMessageType> = Extract<ClientMessage, { t: T }>;
export type MessageHandler<T extends GameMessageType> = (
  session: Session,
  message: GameMessage<T>,
) => void;

export interface NetOptions {
  config: GameConfig;
  log: Logger;
  events: EventBus;
  scheduler: Scheduler;
  /** Sign-in (Clerk tokens, dev names) and chosen names. */
  accounts: Pick<Accounts, 'signIn' | 'devSignIn' | 'setName'>;
  /** Accept `hello { devName }` without an account (DEV_AUTH; never in production). */
  devAuth: boolean;
  /** Clock for rate limits and latency, in ms (default: performance.now). */
  now?: () => number;
}

/**
 * Network sessions of the game: handshake, validation and rate limits of client messages, heartbeat,
 * and dispatch of game messages to the module handlers. Independent of the socket library: a WebSocket
 * (or a test double) is plugged in through `connect`, `receive`, `handlePong` and `handleClose`.
 */
export class NetServer {
  private readonly sessions = new Map<number, Session>();
  private readonly handlers = new Map<GameMessageType, MessageHandler<GameMessageType>>();
  private readonly now: () => number;
  private nextId = 1;

  constructor(private readonly options: NetOptions) {
    this.now = options.now ?? (() => performance.now());
    options.scheduler.every(
      options.config.net.heartbeatIntervalMs,
      () => this.heartbeat(),
      'net: heartbeat',
    );
  }

  /** Whether dev logins and dev tools (debug camera) are allowed. */
  get devAuth(): boolean {
    return this.options.devAuth;
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  allSessions(): Session[] {
    return [...this.sessions.values()];
  }

  /** Registers the handler of a game message type (one per type). */
  onMessage<T extends GameMessageType>(type: T, handler: MessageHandler<T>): void {
    if (this.handlers.has(type)) {
      throw new Error(`A handler is already registered for "${type}" messages`);
    }
    this.handlers.set(type, handler as unknown as MessageHandler<GameMessageType>);
  }

  /** A client connected: its session waits for a `hello`. */
  connect(transport: Transport): Session {
    const { config, scheduler } = this.options;
    const now = this.now();
    const limits = new Map(
      CLIENT_MESSAGE_TYPES.map((type) => {
        const { max, windowMs } = config.net.rateLimits[type];
        return [type, new TokenBucket(max, windowMs, now)] as const;
      }),
    );
    const violations = new TokenBucket(config.net.maxViolations, config.net.violationWindowMs, now);
    const session = new Session(this.nextId++, transport, limits, violations);
    this.sessions.set(session.id, session);
    session.cancelHelloTimeout = scheduler.after(
      config.net.helloTimeoutMs,
      () => this.disconnect(session, CloseCode.policyViolation, 'no hello in time'),
      'net: hello timeout',
    );
    this.options.log.debug({ session: session.id }, 'connection opened');
    return session;
  }

  /** Data received from a client. Bad or excessive messages are ignored; never throws. */
  receive(session: Session, data: Uint8Array, isBinary = true): void {
    if (session.state === 'closed') {
      return;
    }
    if (!isBinary) {
      this.ignore(session, 'text frame');
      return;
    }
    const parsed = parseClientMessage(data);
    if (!parsed.ok) {
      this.ignore(session, 'invalid message', parsed.error);
      return;
    }
    const message = parsed.message;
    if (!session.limits.get(message.t)?.take(this.now())) {
      this.ignore(session, `too many "${message.t}" messages`);
      return;
    }
    try {
      this.dispatch(session, message);
    } catch (error) {
      this.options.log.error(
        { err: error, session: session.id, type: message.t },
        'message failed',
      );
    }
  }

  /** The client answered the heartbeat ping. */
  handlePong(session: Session): void {
    if (session.pingSentAt !== undefined) {
      session.latencyMs = this.now() - session.pingSentAt;
      session.pingSentAt = undefined;
    }
  }

  /** The connection closed on the client side. */
  handleClose(session: Session): void {
    this.disconnect(session, CloseCode.normal, 'connection closed');
  }

  send(session: Session, message: ServerMessage): void {
    if (session.state !== 'closed') {
      session.transport.send(encodeMessage(message));
    }
  }

  /** Ends a session: closes its connection and emits `session.closed`. Safe to call twice. */
  disconnect(session: Session, code: number, reason: string): void {
    if (session.state === 'closed') {
      return;
    }
    session.state = 'closed';
    session.cancelHelloTimeout?.();
    this.sessions.delete(session.id);
    try {
      session.transport.close(code, reason);
    } catch (error) {
      this.options.log.debug({ err: error, session: session.id }, 'close failed');
    }
    this.options.log.debug({ session: session.id, reason }, 'connection closed');
    this.options.events.emit('session.closed', { session, reason });
  }

  /** Sends `rejected` then ends the session. */
  reject(session: Session, reason: RejectReason): void {
    this.send(session, { t: 'rejected', reason });
    this.disconnect(session, CloseCode.normal, `rejected: ${reason}`);
  }

  /** Players with an open session past the sign-in: playing, waiting for approval or naming. */
  connectedPlayerIds(): Set<number> {
    const ids = new Set<number>();
    for (const session of this.sessions.values()) {
      if (session.account) {
        ids.add(session.account.playerId);
      }
    }
    return ids;
  }

  /**
   * An admin changed an account: a banned or denied player leaves at once, with the matching screen;
   * an approved player who was waiting enters the game.
   */
  applyAccount(account: Account): void {
    for (const session of this.sessionsOf(account.playerId)) {
      if (
        account.status === 'banned' ||
        account.status === 'denied' ||
        session.state === 'waiting'
      ) {
        this.admit(session, account);
      } else {
        session.account = account;
      }
    }
  }

  /** An admin kicks a player out (they can come back); false when the player is not connected. */
  kick(playerId: number): boolean {
    const sessions = this.sessionsOf(playerId);
    for (const session of sessions) {
      this.reject(session, 'kicked');
    }
    return sessions.length > 0;
  }

  /** Closes every session (server shutdown). */
  closeAll(reason: string): void {
    for (const session of this.allSessions()) {
      this.disconnect(session, CloseCode.goingAway, reason);
    }
  }

  /** Pings every session; drops the ones that did not answer the previous ping. */
  heartbeat(): void {
    const now = this.now();
    for (const session of this.allSessions()) {
      if (session.pingSentAt !== undefined) {
        this.options.log.info({ session: session.id, name: session.name }, 'heartbeat lost');
        this.disconnect(session, CloseCode.goingAway, 'heartbeat timeout');
        continue;
      }
      session.pingSentAt = now;
      session.transport.ping();
    }
  }

  private sessionsOf(playerId: number): Session[] {
    return this.allSessions().filter((session) => session.account?.playerId === playerId);
  }

  private dispatch(session: Session, message: ClientMessage): void {
    switch (message.t) {
      case 'hello':
        this.handleHello(session, message);
        return;
      case 'setName':
        this.handleSetName(session, message.name);
        return;
      case 'ping':
        this.send(session, { t: 'pong', time: message.time });
        return;
      default: {
        if (session.state !== 'playing') {
          this.ignore(session, `"${message.t}" before joining`);
          return;
        }
        this.handlers.get(message.t)?.(session, message);
      }
    }
  }

  private handleHello(session: Session, hello: HelloMessage): void {
    if (session.state !== 'handshake') {
      this.ignore(session, 'hello after the handshake');
      return;
    }
    if (hello.version !== PROTOCOL_VERSION) {
      this.reject(session, 'outdated');
      return;
    }
    const { accounts, devAuth } = this.options;
    let signIn: Promise<Account | undefined>;
    if (hello.devName !== undefined) {
      if (!devAuth) {
        this.reject(session, 'devAuthDisabled');
        return;
      }
      if (!isValidPlayerName(hello.devName)) {
        this.reject(session, 'invalidName');
        return;
      }
      signIn = accounts.devSignIn(hello.devName);
    } else if (hello.token !== undefined) {
      signIn = accounts.signIn(hello.token);
    } else {
      this.reject(session, 'invalidToken');
      return;
    }
    session.state = 'signingIn';
    signIn.then(
      (account) => {
        if (session.state === 'closed') {
          return;
        }
        if (!account) {
          this.reject(session, 'invalidToken');
          return;
        }
        session.cancelHelloTimeout?.();
        this.admit(session, account);
      },
      (error: unknown) => this.failSignIn(session, error),
    );
  }

  /** A player who needs a name sent one: checked, then the account goes on. */
  private handleSetName(session: Session, name: string): void {
    const account = session.account;
    if (session.state !== 'naming' || !account) {
      this.ignore(session, 'setName out of place');
      return;
    }
    session.state = 'signingIn';
    this.options.accounts.setName(account.playerId, name).then(
      (result) => {
        if (session.state === 'closed') {
          return;
        }
        if (!result.ok) {
          session.state = 'naming';
          this.send(session, { t: 'status', state: 'needsName', nameError: result.error });
          return;
        }
        this.options.log.info({ playerId: account.playerId, name }, 'player named');
        this.admit(session, result.account);
      },
      (error: unknown) => this.failSignIn(session, error),
    );
  }

  /** Lets a signed-in account in, or tells it why not yet. */
  private admit(session: Session, account: Account): void {
    session.account = account;
    if (account.status === 'banned' || account.status === 'denied') {
      this.send(session, {
        t: 'status',
        state: account.status,
        ...(account.banReason !== null && { reason: account.banReason }),
      });
      this.disconnect(session, CloseCode.normal, `account ${account.status}`);
      return;
    }
    if (account.name === null) {
      session.state = 'naming';
      this.send(session, { t: 'status', state: 'needsName' });
      return;
    }
    if (account.status === 'pending') {
      session.state = 'waiting';
      this.send(session, { t: 'status', state: 'pending' });
      return;
    }
    this.enterGame(session, account, account.name);
  }

  private enterGame(session: Session, account: Account, name: string): void {
    // The same player connected again (another tab…): the older session ends.
    for (const other of this.allSessions()) {
      if (other !== session && other.account?.playerId === account.playerId) {
        this.reject(other, 'replaced');
      }
    }
    session.name = name;
    this.options.events.emit('session.authenticated', { session });
    if (!session.player) {
      this.reject(session, 'unavailable');
      return;
    }
    session.state = 'playing';
    this.send(session, {
      t: 'welcome',
      you: { ...session.player },
      tick: this.options.scheduler.currentTick,
    });
  }

  private failSignIn(session: Session, error: unknown): void {
    this.options.log.error({ err: error, session: session.id }, 'sign-in failed');
    if (session.state !== 'closed') {
      this.reject(session, 'unavailable');
    }
  }

  private ignore(session: Session, reason: string, detail?: string): void {
    this.options.log.debug({ session: session.id, reason, detail }, 'message ignored');
    if (!session.violations.take(this.now())) {
      this.options.log.warn(
        { session: session.id, name: session.name, reason },
        'too many ignored messages: disconnecting',
      );
      this.disconnect(session, CloseCode.policyViolation, 'too many invalid messages');
    }
  }
}
