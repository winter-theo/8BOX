import type { Facing } from '../sim/movement';
import type { ActionSubject } from './actions';

/** A point or a tile, in tiles. */
export interface TilePoint {
  x: number;
  y: number;
}

/** One step in the direction a character faces, in tiles (y grows downwards). */
export const FACING_STEP: Readonly<Record<Facing, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Distance from a point to the nearest point of tile (x, y): 0 inside it, in tiles. */
export function distanceToTile(point: TilePoint, x: number, y: number): number {
  const dx = Math.max(x - point.x, 0, point.x - (x + 1));
  const dy = Math.max(y - point.y, 0, point.y - (y + 1));
  return Math.hypot(dx, dy);
}

/** Whether a player with feet at `feet` reaches tile (x, y). */
export function tileInReach(feet: TilePoint, x: number, y: number, reachTiles: number): boolean {
  return distanceToTile(feet, x, y) <= reachTiles;
}

/** Whether a player reaches a subject: a tile, an entity (through the tile under it), or themselves. */
export function subjectInReach(
  feet: TilePoint,
  subject: ActionSubject,
  reachTiles: number,
): boolean {
  switch (subject.kind) {
    case 'tile':
      return tileInReach(feet, subject.x, subject.y, reachTiles);
    case 'entity':
      return tileInReach(feet, Math.floor(subject.x), Math.floor(subject.y), reachTiles);
    case 'self':
      return true;
  }
}

/** The tile in front of a character: next to the tile of its feet, in the direction it faces. */
export function facingTile(feet: TilePoint, facing: Facing): TilePoint {
  const [dx, dy] = FACING_STEP[facing];
  return { x: Math.floor(feet.x) + dx, y: Math.floor(feet.y) + dy };
}

/**
 * The tile a player aims at: the tile under the mouse when there is one and it is in reach (computer),
 * otherwise the tile in front of them.
 */
export function aimedTile(
  feet: TilePoint,
  facing: Facing,
  pointerTile: TilePoint | undefined,
  reachTiles: number,
): TilePoint {
  if (pointerTile && tileInReach(feet, pointerTile.x, pointerTile.y, reachTiles)) {
    return { x: pointerTile.x, y: pointerTile.y };
  }
  return facingTile(feet, facing);
}
