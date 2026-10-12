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
export type GameMessageType = Exclude<ClientMessageType, 'hello' | 'ping'>;
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

  private dispatch(session: Session, message: ClientMessage): void {
    switch (message.t) {
      case 'hello':
        this.handleHello(session, message);
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
    // Accounts come with step 11; until then only the dev mode can authenticate.
    if (!this.options.devAuth) {
      this.reject(session, 'devAuthDisabled');
      return;
    }
    const name = hello.devName;
    if (name === undefined || !isValidPlayerName(name)) {
      this.reject(session, 'invalidName');
      return;
    }
    for (const other of this.allSessions()) {
      if (other !== session && other.name?.toLowerCase() === name.toLowerCase()) {
        this.reject(other, 'replaced');
      }
    }

    session.name = name;
    session.cancelHelloTimeout?.();
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
