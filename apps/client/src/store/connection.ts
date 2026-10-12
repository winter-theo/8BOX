import { create } from 'zustand';

export type ConnectionStatus = 'online' | 'offline';

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  status: 'offline',
  setStatus: (status) => set({ status }),
}));
