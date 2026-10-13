import { TIME } from '../config/time';

/** Part of the day/night cycle: the daytime starts with the dawn, the nighttime with the dusk. */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** Lengths of the day/night cycle (`TIME`), in ms. */
export interface DayCycle {
  dayLengthMs: number;
  daytimeMs: number;
  twilightMs: number;
}

/**
 * Time within the current day, in ms since the start of its daytime (dawn), in [0, dayLengthMs).
 * `worldTimeMs` is the world clock: ms of world time since the world was created.
 */
export function timeOfDay(worldTimeMs: number, cycle: DayCycle = TIME): number {
  const time = worldTimeMs % cycle.dayLengthMs;
  return time < 0 ? time + cycle.dayLengthMs : time;
}

/** Whether it is daytime (dawn included) rather than nighttime (dusk included). */
export function isDaytime(worldTimeMs: number, cycle: DayCycle = TIME): boolean {
  return timeOfDay(worldTimeMs, cycle) < cycle.daytimeMs;
}

/** Part of the cycle: dawn and dusk are the first `twilightMs` of the daytime and of the nighttime. */
export function dayPhase(worldTimeMs: number, cycle: DayCycle = TIME): DayPhase {
  const time = timeOfDay(worldTimeMs, cycle);
  if (time < cycle.daytimeMs) {
    return time < cycle.twilightMs ? 'dawn' : 'day';
  }
  return time - cycle.daytimeMs < cycle.twilightMs ? 'dusk' : 'night';
}

/**
 * Share of daylight, from 0 (night) to 1 (day): it rises evenly through the dawn and falls evenly
 * through the dusk.
 */
export function daylight(worldTimeMs: number, cycle: DayCycle = TIME): number {
  const time = timeOfDay(worldTimeMs, cycle);
  const daytime = time < cycle.daytimeMs;
  if (cycle.twilightMs <= 0) {
    return daytime ? 1 : 0;
  }
  return daytime
    ? Math.min(1, time / cycle.twilightMs)
    : Math.max(0, 1 - (time - cycle.daytimeMs) / cycle.twilightMs);
}

/** Hours (0 to 23) and minutes (0 to 59) of the HUD clock: a 24-hour day, `dawnHour` at dawn. */
export function clockTime(
  worldTimeMs: number,
  cycle: DayCycle = TIME,
  dawnHour: number = TIME.dawnClockHour,
): { hours: number; minutes: number } {
  const minutesPerDay = 24 * 60;
  const minutes = Math.floor(
    (timeOfDay(worldTimeMs, cycle) / cycle.dayLengthMs) * minutesPerDay + dawnHour * 60,
  );
  const ofDay = minutes % minutesPerDay;
  return { hours: Math.floor(ofDay / 60), minutes: ofDay % 60 };
}
