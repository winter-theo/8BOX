import { SECOND_MS } from './units';

export const MONSTERS = {
  /** Night monsters spawn in a ring around each player: inner radius, in tiles. */
  spawnMinDistanceTiles: 18,
  /** Outer radius of the spawn ring, in tiles. */
  spawnMaxDistanceTiles: 32,
  /** Distance at which a monster notices a player, in tiles. */
  detectionRangeTiles: 10,
  /** Max monsters spawned for one player, in monsters. */
  maxPerPlayer: 6,
  /** Max monsters in the whole world, in monsters. */
  maxTotal: 150,
  /** Share of the monsters that vanish at dawn, from 0 to 1. */
  dawnDespawnFraction: 0.8,
  /** A monster farther than this from every player starts to despawn, in tiles. */
  farDespawnDistanceTiles: 64,
  /** Time a monster must stay that far before it despawns, in ms. */
  farDespawnDelayMs: 60 * SECOND_MS,
} as const;
