import { MINUTE_MS, SECOND_MS } from './units';

export const HARVEST = {
  /** A damaged natural element gets all its HP back after this long without being hit, in ms. */
  hpRecoveryDelayMs: 30 * SECOND_MS,
  /** Time for a picked berry bush to bear berries again, in ms (10 min). */
  berryRegrowMs: 10 * MINUTE_MS,
  /** Chance that harvesting an oak also gives an apple, from 0 to 1. */
  appleChance: 0.2,
} as const;
