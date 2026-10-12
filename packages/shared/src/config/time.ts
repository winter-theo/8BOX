import { MINUTE_MS } from './units';

export const TIME = {
  /** Length of a full day/night cycle (one game day), in ms of real time (60 min). */
  dayLengthMs: 60 * MINUTE_MS,
  /** Daytime part of the cycle, in ms (30 min). */
  daytimeMs: 30 * MINUTE_MS,
  /** Night part of the cycle, in ms (30 min). */
  nighttimeMs: 30 * MINUTE_MS,
  /** Length of the dawn transition and of the dusk transition, in ms (3 min each). */
  twilightMs: 3 * MINUTE_MS,
  /** Length of a season, in game days (7 game days = 7 real hours). */
  seasonLengthDays: 7,
} as const;
