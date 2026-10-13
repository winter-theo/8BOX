import { isDoorOpen, type TileDef, type TileMeta } from '@8box/shared';

/** Sides of a tile, as bits of the join mask of a wall. */
export const SIDE_BITS = { n: 1, e: 2, s: 4, w: 8 } as const;
type Side = keyof typeof SIDE_BITS;

/** The sides in the order of their bits, with the offset of the neighbor on each. */
const SIDES: readonly (readonly [Side, number, number])[] = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
];

/** Number of join masks: one per set of joined sides. */
export const WALL_MASKS = 16;

/** Whether a wall joins the tile next to it: a wall or a door. */
export function joinsWalls(tile: TileDef | undefined): boolean {
  return tile?.wall === true || tile?.door === true;
}

/** Join mask of the wall on (x, y): one bit (`SIDE_BITS`) per side whose neighbor `joins`. */
export function wallMask(x: number, y: number, joins: (x: number, y: number) => boolean): number {
  let mask = 0;
  for (const [side, dx, dy] of SIDES) {
    if (joins(x + dx, y + dy)) {
      mask |= SIDE_BITS[side];
    }
  }
  return mask;
}

/** Name of a join mask: the joined sides in the order n, e, s, w (`ew`, `nesw`), or `none`. */
export function wallSuffix(mask: number): string {
  const sides = SIDES.filter(([side]) => (mask & SIDE_BITS[side]) !== 0).map(([side]) => side);
  return sides.length === 0 ? 'none' : sides.join('');
}

/** Sprite of a wall joined on the sides of `mask`: `<sprite>.<sides>`. */
export function wallSpriteId(sprite: string, mask: number): string {
  return `${sprite}.${wallSuffix(mask)}`;
}

/** Sprite of an open door: `<sprite>.open`. */
export function openDoorSpriteId(sprite: string): string {
  return `${sprite}.open`;
}

/**
 * Sprite of the object on tile (x, y): a wall is drawn joined to the walls and doors around it (its
 * front face shows only without one below), an open door open; anything else as its tile says.
 */
export function objectSpriteId(
  tile: TileDef,
  x: number,
  y: number,
  meta: TileMeta | undefined,
  neighbor: (x: number, y: number) => TileDef | undefined,
): string {
  if (tile.wall) {
    return wallSpriteId(
      tile.sprite,
      wallMask(x, y, (nx, ny) => joinsWalls(neighbor(nx, ny))),
    );
  }
  if (tile.door && isDoorOpen(meta)) {
    return openDoorSpriteId(tile.sprite);
  }
  return tile.sprite;
}
