import type { AccountState, NameError, RejectReason } from '@8box/shared';
import { create } from 'zustand';
import type { DebugStats } from '../game/events';

/**
 * `idle`: not connected (login screen); `connecting`: first attempt; `account`: signed in but not in the
 * game (name to pick, waiting for the admin, denied, banned); `online`: welcomed by the server;
 * `reconnecting`: connection lost, retrying; `rejected`: refused by the server, no retry.
 */
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'account'
  | 'online'
  | 'reconnecting'
  | 'rejected';

/** Where the account stands while it cannot play (`status` message). */
export interface AccountScreen {
  state: AccountState;
  /** Why the player is banned. */
  reason: string | null;
  /** Why the last chosen name was refused. */
  nameError: NameError | null;
}

export interface LocalPlayer {
  entity: number;
  name: string;
}

interface SessionState {
  status: ConnectionStatus;
  /** Last measured round trip to the server, in ms. */
  pingMs: number | null;
  player: LocalPlayer | null;
  rejectReason: RejectReason | null;
  account: AccountScreen | null;
  /** Chunks currently received from the server (dev info). */
  loadedChunks: number;
  /** Feet of the local player, in tiles (dev info). */
  playerPosition: { x: number; y: number } | null;
  /** Center of the free camera, in tiles (dev mode); null when the camera follows the player. */
  debugCamera: { x: number; y: number } | null;
  /** Rendering figures (dev mode). */
  debugStats: DebugStats | null;
}

/** Written by the GameClient only; the UI reads it with selectors. */
export const useSessionStore = create<SessionState>()(() => ({
  status: 'idle',
  pingMs: null,
  player: null,
  rejectReason: null,
  account: null,
  loadedChunks: 0,
  playerPosition: null,
  debugCamera: null,
  debugStats: null,
}));
