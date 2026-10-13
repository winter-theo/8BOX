import { SECOND_MS } from './units';

// What a tile gives and how fast it grows back are content (`loot.json`, `regrow` of a tile):
// an oak gives 2 to 4 logs and an apple 20 % of the time, berries grow back in 10 minutes.
export const HARVEST = {
  /** A damaged natural element gets all its HP back after this long without being hit, in ms. */
  hpRecoveryDelayMs: 30 * SECOND_MS,
  /** HP a hit takes bare-handed (or holding something that is not a tool), in HP. */
  handDamage: 1,
  /** HP a hit takes with a tool that is not the right kind for the tile, in HP. */
  wrongToolDamage: 1,
  /** Time it takes to pick a berry bush, in ms. */
  pickDurationMs: 1 * SECOND_MS,
} as const;
