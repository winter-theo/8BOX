export const LOOP = {
  /** Max ticks run in a row to catch up after a slowdown; older lag is dropped, in ticks. */
  maxCatchUpTicks: 5,
  /** Tick durations averaged for the tick time statistics, in ticks (100 = the last 5 s). */
  statsWindowTicks: 100,
} as const;
