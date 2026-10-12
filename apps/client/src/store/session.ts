import type { RejectReason } from '@8box/shared';
import { create } from 'zustand';
import type { DebugStats } from '../game/events';

/**
 * `idle`: not connected (login screen); `connecting`: first attempt; `online`: welcomed by the server;
 * `reconnecting`: connection lost, retrying; `rejected`: refused by the server, no retry.
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'rejected';

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
  /** Chunks currently received from the server (dev info). */
  loadedChunks: number;
  /** Position of the test character followed by the camera, in tiles (dev mode). */
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
  loadedChunks: 0,
  debugCamera: null,
  debugStats: null,
}));
