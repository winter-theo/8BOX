import type {
  CreatureDef,
  MovementWorld,
  Rng,
  TileDef,
  TileMeta,
  TilePoint,
  TileSlot,
} from '@8box/shared';
import { roomOf } from '@8box/shared';

/** What the spawning rules look at on a tile of a layer. */
export interface SpawnWorld {
  /** Solid tiles (outside the world is solid). */
  movement: MovementWorld;
  tileAt(x: number, y: number, slot: TileSlot): TileDef | undefined;
  metaAt(x: number, y: number): TileMeta | undefined;
  inSafeZone(x: number, y: number): boolean;
  /** Whether the tile is lit now (`isLit`): the costliest check, done last. */
  isLit(x: number, y: number): boolean;
}

/**
 * Whether a monster may appear on tile (x, y): out of the safe zone, on a tile that does not block, not
 * on water, not on a built floor nor in a room (bases stay safe from the inside), and in the dark.
 */
export function canSpawnAt(world: SpawnWorld, x: number, y: number): boolean {
  return (
    !world.inSafeZone(x, y) &&
    !world.movement.isSolid(x, y) &&
    !world.tileAt(x, y, 'ground')?.water &&
    world.tileAt(x, y, 'floor') === undefined &&
    roomOf(world.metaAt(x, y)) === undefined &&
    !world.isLit(x, y)
  );
}

/** A random tile of the ring between `minTiles` and `maxTiles` around (x, y), evenly over its area. */
export function ringTile(
  rng: Rng,
  x: number,
  y: number,
  minTiles: number,
  maxTiles: number,
): TilePoint {
  const angle = rng.float(0, Math.PI * 2);
  const radius = Math.sqrt(rng.float(minTiles ** 2, maxTiles ** 2));
  return {
    x: Math.floor(x + Math.cos(angle) * radius),
    y: Math.floor(y + Math.sin(angle) * radius),
  };
}

/** Whether the centre of tile (x, y) is at least `minTiles` from every position. */
export function farFromAll(
  x: number,
  y: number,
  positions: readonly { x: number; y: number }[],
  minTiles: number,
): boolean {
  return positions.every((p) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) >= minTiles);
}

/** Whether one more monster may appear for a player who has `own` of them, `total` in the world. */
export function underCaps(
  own: number,
  total: number,
  caps: { maxPerPlayer: number; maxTotal: number },
): boolean {
  return own < caps.maxPerPlayer && total < caps.maxTotal;
}

/** The creatures that appear at night, each with its chance (`nightSpawnWeight`). */
export function nightCreatures(creatures: readonly CreatureDef[]): CreatureDef[] {
  return creatures.filter((creature) => creature.nightSpawnWeight !== undefined);
}

/** One of the creatures, picked by weight (`nightSpawnWeight`); undefined when there is none. */
export function pickCreature(creatures: readonly CreatureDef[], rng: Rng): CreatureDef | undefined {
  const total = creatures.reduce((sum, creature) => sum + (creature.nightSpawnWeight ?? 0), 0);
  let roll = rng.float(0, total);
  for (const creature of creatures) {
    roll -= creature.nightSpawnWeight ?? 0;
    if (roll < 0) {
      return creature;
    }
  }
  return creatures.at(-1);
}
