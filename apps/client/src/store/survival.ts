import type { DamageCause, VitalsMessage } from '@8box/shared';
import { create } from 'zustand';

interface SurvivalState {
  /** Health of the local player, in HP, as the server last sent it; null when not in the world. */
  health: number | null;
  /** Hunger of the local player, in hunger points; null when not in the world. */
  hunger: number | null;
  /** Dead, waiting to respawn: what killed them; null when alive. */
  dead: DamageCause | null;
}

const initialState: SurvivalState = { health: null, hunger: null, dead: null };

/** Written by the GameClient only (what the server sends). */
export const useSurvivalStore = create<SurvivalState>()(() => initialState);

export function receiveVitals({ health, hunger, dead }: VitalsMessage): void {
  useSurvivalStore.setState({ health, hunger, dead: dead ?? null });
}

/** Forgets everything (the player left the world). */
export function clearSurvival(): void {
  useSurvivalStore.setState(initialState);
}
