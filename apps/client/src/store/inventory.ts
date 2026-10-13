import type { Inventory } from '@8box/shared';
import { create } from 'zustand';

interface InventoryState {
  /** The inventory of the local player, as the server last sent it; null when not in the world. */
  inventory: Inventory | null;
  /** Whether the inventory window is open. */
  open: boolean;
}

/** The inventory is written by the GameClient only; `open` by the UI and the keyboard. */
export const useInventoryStore = create<InventoryState>()(() => ({
  inventory: null,
  open: false,
}));

export function toggleInventoryWindow(): void {
  useInventoryStore.setState((state) => ({ open: !state.open }));
}

export function closeInventoryWindow(): void {
  useInventoryStore.setState({ open: false });
}
