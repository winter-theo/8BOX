import { SECOND_MS } from './units';

export const MONSTERS = {
  /** Night monsters spawn in a ring around each player: inner radius, in tiles. */
  spawnMinDistanceTiles: 18,
  /** Outer radius of the spawn ring, in tiles. */
  spawnMaxDistanceTiles: 32,
  /** Time between two rounds of spawning (at most one monster per player) and despawning, in ms. */
  spawnIntervalMs: 3 * SECOND_MS,
  /** Random tiles of the ring tried per player and per round before giving up, in tries. */
  spawnTriesPerPlayer: 8,
  /** Distance at which a monster notices a player, in tiles. */
  detectionRangeTiles: 10,
  /** Time between two looks around of a wandering monster, in ms. */
  lookIntervalMs: 250,
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
  /** A wandering monster walks this long in a random direction, in ms. */
  wanderMoveMs: 1500,
  /** Then it stands still up to this long (a random time), in ms. */
  wanderRestMs: 3 * SECOND_MS,
  /** A monster hits a character whose feet are this close to its own, in tiles. */
  attackRangeTiles: 0.8,
  /** A chasing monster gives up when its target gets this far, in tiles. */
  giveUpDistanceTiles: 16,
  /** Paths are searched in a square of this half side around the monster, in tiles. */
  pathRadiusTiles: 16,
  /** Shortest time between two path searches of a chasing monster, in ms (twice per second). */
  repathIntervalMs: 500,
  /**
   * Cost of a path through a wall or a door, in tiles of walking: a chasing monster breaks through
   * only when going around is longer than this (or impossible).
   */
  wallPathCost: 24,
  /** Within this distance of its target, a chasing monster walks straight to it, in tiles. */
  closeChaseTiles: 1.5,
} as const;
