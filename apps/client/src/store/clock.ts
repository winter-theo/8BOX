import { clockTime, isDaytime } from '@8box/shared';
import { create } from 'zustand';

/** What the HUD clock shows. */
export interface ClockDisplay {
  /** 0 to 23. */
  hours: number;
  /** 0 to 59. */
  minutes: number;
  /** Daytime (sun, dawn included) or nighttime (moon, dusk included). */
  daytime: boolean;
}

interface ClockState {
  /** Null before the server sent the world clock. */
  clock: ClockDisplay | null;
}

/** Written by the GameClient only, when the shown minute changes. */
export const useClockStore = create<ClockState>()(() => ({ clock: null }));

/** Shows the world time `worldTimeMs` on the HUD clock (undefined: hides it). */
export function showClock(worldTimeMs: number | undefined): void {
  if (worldTimeMs === undefined) {
    clearClock();
    return;
  }
  const { hours, minutes } = clockTime(worldTimeMs);
  const daytime = isDaytime(worldTimeMs);
  const shown = useClockStore.getState().clock;
  if (shown?.hours !== hours || shown.minutes !== minutes || shown.daytime !== daytime) {
    useClockStore.setState({ clock: { hours, minutes, daytime } });
  }
}

export function clearClock(): void {
  useClockStore.setState({ clock: null });
}
