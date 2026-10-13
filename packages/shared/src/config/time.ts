import { MINUTE_MS, SECOND_MS } from './units';

export const TIME = {
  /** Length of a full day/night cycle (one game day), in ms of real time (60 min). */
  dayLengthMs: 60 * MINUTE_MS,
  /** Daytime part of the cycle, in ms (30 min). It starts with the dawn. */
  daytimeMs: 30 * MINUTE_MS,
  /** Night part of the cycle, in ms (30 min). It starts with the dusk. */
  nighttimeMs: 30 * MINUTE_MS,
  /** Length of the dawn transition and of the dusk transition, in ms (3 min each). */
  twilightMs: 3 * MINUTE_MS,
  /** Length of a season, in game days (7 game days = 7 real hours). */
  seasonLengthDays: 7,
  /** Interval between two sendings of the world clock to the clients, in ms (they run it meanwhile). */
  syncIntervalMs: 10 * SECOND_MS,
  /** Time over which a client blends its running clock into a newly received one, in ms (no jump). */
  syncSmoothingMs: SECOND_MS,
  /** Hour shown by the HUD clock at the start of the daytime (dawn), on a 24-hour clock. */
  dawnClockHour: 6,
} as const;
