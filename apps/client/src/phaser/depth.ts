import { WORLD } from '@8box/shared';

const TILE_PX = WORLD.tileSizePx;

/**
 * Drawing order of the world layers. Objects and entities are sorted by the Y of their feet in world
 * pixels (`sortDepth`), so they use values from 0 upwards; the ground stays below them.
 */
export const DEPTH = {
  ground: -1,
  /** The roofs of the rooms: over every Y-sorted sprite (they hide what is inside), under the bars. */
  roof: 999_998,
  /** The HP bars of the tiles being broken: over every Y-sorted sprite, under the aim outline. */
  damage: 999_999,
  /** The outline of the aimed tile: over every Y-sorted sprite (feet Y stays far below). */
  aim: 1_000_000,
} as const;

/** What a Y-sorted sprite is: at the same Y, an entity is drawn over an object. */
export type SortKind = 'object' | 'entity';

/**
 * Added to the depth of entities, so that one standing on the bottom line of an object's tile is in
 * front of it. Far smaller than a pixel: it only breaks ties.
 */
const ENTITY_TIE_BREAK = 1 / 1024;

/**
 * Depth of a sprite whose feet (bottom edge) are at `footYPx` world pixels: lower on the screen is in
 * front. A character behind a tree (feet above the trunk's base) is hidden by the foliage.
 */
export function sortDepth(footYPx: number, kind: SortKind): number {
  return footYPx + (kind === 'entity' ? ENTITY_TIE_BREAK : 0);
}

/** A point in world pixels where a sprite is anchored by the middle of its bottom edge (origin 0.5, 1). */
export interface Anchor {
  x: number;
  y: number;
}

/**
 * Anchor of the object on tile (x, y): the middle of the tile's bottom edge, so that a tall sprite
 * (8 × 16) rises over the tile above.
 */
export function objectAnchor(x: number, y: number): Anchor {
  return { x: (x + 0.5) * TILE_PX, y: (y + 1) * TILE_PX };
}

/** Anchor of an entity at a position in tiles: its feet. */
export function entityAnchor(position: { x: number; y: number }): Anchor {
  return { x: position.x * TILE_PX, y: position.y * TILE_PX };
}
