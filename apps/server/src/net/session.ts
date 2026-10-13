import type { ClientMessageType, Skin, WorldPosition } from '@8box/shared';
import type { Account } from '../accounts/account';
import type { EntityId } from '../core/entities';
import type { ChunkSubscriptions } from './interest';
import type { TokenBucket } from './rateLimit';

/** What a session needs from its connection (a WebSocket, or a fake one in tests). */
export interface Transport {
  send(data: Uint8Array): void;
  close(code: number, reason: string): void;
  /** Sends a heartbeat ping; the answer comes back through `NetServer.handlePong`. */
  ping(): void;
}

/**
 * `handshake`: waiting for a valid `hello`; `signingIn`: checking the account (or a chosen name);
 * `naming`: waiting for `setName`; `waiting`: pending approval; `playing`: joined; `closed`: gone.
 */
export type SessionState = 'handshake' | 'signingIn' | 'naming' | 'waiting' | 'playing' | 'closed';

export interface SessionPlayer {
  entity: EntityId;
  name: string;
  /** Skin when the player entered the world (sent in `welcome`). */
  skin: Skin;
  /** Where the player entered the world (sent in `welcome`). */
  position: WorldPosition;
}

/** One connected client. Created by `NetServer.connect`, one per socket. */
export class Session {
  state: SessionState = 'handshake';
  /** Name of the player, once in the game. */
  name: string | undefined;
  /** The signed-in account (set by the handshake). */
  account: Account | undefined;
  /** Set by the module that spawns the player when the session is authenticated. */
  player: SessionPlayer | undefined;
  /** Chunks this client receives; set by the module that streams the world. */
  chunks: ChunkSubscriptions | undefined;
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
