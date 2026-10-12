import type { RejectReason } from '@8box/shared';
import { create } from 'zustand';

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
}

/** Written by the GameClient only; the UI reads it with selectors. */
export const useSessionStore = create<SessionState>()(() => ({
  status: 'idle',
  pingMs: null,
  player: null,
  rejectReason: null,
}));
