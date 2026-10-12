import { DAY_MS } from './units';

export const WORLD = {
  /** Width and height of a layer, in tiles. */
  layerSizeTiles: 1024,
  /** Width and height of a chunk, in tiles. */
  chunkSizeTiles: 32,
  /** Radius of the safe zone around the spawn point, in tiles. */
  safeZoneRadiusTiles: 32,
  /** Radius of the clearing (no trees) at the spawn point, in tiles. */
  spawnClearingRadiusTiles: 6,
  /** Side of a regeneration zone, regenerated only when nothing is built in it, in tiles. */
  regenerationZoneSizeTiles: 32,
  /** Time between two regenerations of an untouched zone, in ms (7 real days). */
  regenerationIntervalMs: 7 * DAY_MS,
} as const;
