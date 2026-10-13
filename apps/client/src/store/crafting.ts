import { create } from 'zustand';

interface CraftingState {
  /** Whether the crafting window is open. */
  open: boolean;
  /** Ids of the stations within reach of the player, as the client sees the world (sorted). */
  stations: readonly string[];
  /** The craft in progress, as the server said: recipe id and crafts left (this one included). */
  current: { recipe: string; left: number } | null;
}

const initialState: CraftingState = { open: false, stations: [], current: null };

/** Written by the GameClient (stations, server answers) and the UI and keyboard (`open`). */
export const useCraftingStore = create<CraftingState>()(() => initialState);

export function toggleCraftingWindow(): void {
  useCraftingStore.setState((state) => ({ open: !state.open }));
}

export function closeCraftingWindow(): void {
  useCraftingStore.setState({ open: false });
}

/** Sets the stations in reach, only when they changed (no needless re-render). */
export function setStationsInReach(stations: readonly string[]): void {
  const current = useCraftingStore.getState().stations;
  if (current.length !== stations.length || current.some((station, i) => station !== stations[i])) {
    useCraftingStore.setState({ stations });
  }
}

/** Forgets everything (the player left the world). */
export function clearCrafting(): void {
  useCraftingStore.setState(initialState);
}
