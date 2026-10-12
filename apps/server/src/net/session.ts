import type { ClientMessageType } from '@8box/shared';
import type { EntityId } from '../core/entities';
import type { TokenBucket } from './rateLimit';

/** What a session needs from its connection (a WebSocket, or a fake one in tests). */
export interface Transport {
  send(data: Uint8Array): void;
  close(code: number, reason: string): void;
  /** Sends a heartbeat ping; the answer comes back through `NetServer.handlePong`. */
  ping(): void;
}

/** `handshake`: waiting for a valid `hello`; `playing`: joined; `closed`: gone for good. */
export type SessionState = 'handshake' | 'playing' | 'closed';

export interface SessionPlayer {
  entity: EntityId;
  name: string;
}

/** One connected client. Created by `NetServer.connect`, one per socket. */
export class Session {
  state: SessionState = 'handshake';
  /** Name proven by the handshake (dev name for now, account name later). */
  name: string | undefined;
  /** Set by the module that spawns the player when the session is authenticated. */
  player: SessionPlayer | undefined;
  /** Round trip time measured by the heartbeat, in ms. */
  latencyMs: number | undefined;
  /** Time the unanswered heartbeat ping was sent, in ms. */
  pingSentAt: number | undefined;
  cancelHelloTimeout: (() => void) | undefined;

  constructor(
    readonly id: number,
    readonly transport: Transport,
    /** One bucket per client message type. */
    readonly limits: ReadonlyMap<ClientMessageType, TokenBucket>,
    /** Ignored messages allowed before the session is dropped. */
    readonly violations: TokenBucket,
  ) {}
}
