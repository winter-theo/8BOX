import type { Position, SpawnPoint } from '../../core/entities';

/** What the choice of a respawn point needs to know of the world. */
export interface RespawnWorld {
  /** Whether tile (x, y) of a layer holds a bed. */
  isBed(layer: number, x: number, y: number): boolean;
  /** Whether a character can stand on tile (x, y) of a layer. */
  isFree(layer: number, x: number, y: number): boolean;
}

/** Tiles around a bed (which is solid) where a character comes back: in front of it first. */
const AROUND_BED: readonly (readonly [number, number])[] = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, -1],
];

/**
 * Where a dead player comes back: next to their bed (`spawnPoint`) if it still exists and a tile
 * around it is free, otherwise at the spawn of the world. `bedExists` is false when the bed is gone
 * (or was never set): it is then forgotten.
 */
export function respawnPoint(
  bed: SpawnPoint | undefined,
  world: RespawnWorld,
  spawn: Position,
): { position: Position; bedExists: boolean } {
  if (!bed || !world.isBed(bed.layer, bed.x, bed.y)) {
    return { position: spawn, bedExists: false };
  }
  for (const [dx, dy] of AROUND_BED) {
    const x = bed.x + dx;
    const y = bed.y + dy;
    if (world.isFree(bed.layer, x, y)) {
      return { position: { layer: bed.layer, x: x + 0.5, y: y + 0.5 }, bedExists: true };
    }
  }
  return { position: spawn, bedExists: true };
}
