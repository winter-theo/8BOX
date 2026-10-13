import { PLAYER } from '../config/player';
import type { TileDef, TileSlot } from '../content/schemas';
import type { TileMeta } from '../world/chunk';
import { tileBlocks } from '../world/doors';

/** Where a character looks: the last direction it moved in (aim and hits use it). */
export type Facing = 'up' | 'down' | 'left' | 'right';

/**
 * Movement directions, as sent in `input.dir`: 0 = still, then the 8 directions clockwise from up.
 * Each is a (dx, dy) pair of -1, 0 or 1 (y grows downwards).
 */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/** Largest valid `input.dir`. */
export const MAX_DIRECTION = DIRECTIONS.length - 1;

/** Direction index of a movement along (dx, dy); only the signs count. */
export function directionOf(dx: number, dy: number): number {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  return DIRECTIONS.findIndex(([x, y]) => x === sx && y === sy);
}

/** Facing after moving in direction `dir`: a diagonal keeps the facing when it is one of its sides. */
export function facingAfter(dir: number, previous: Facing): Facing {
  const [dx, dy] = DIRECTIONS[dir] ?? [0, 0];
  const horizontal: Facing | undefined = dx > 0 ? 'right' : dx < 0 ? 'left' : undefined;
  const vertical: Facing | undefined = dy > 0 ? 'down' : dy < 0 ? 'up' : undefined;
  if (previous === horizontal || previous === vertical) {
    return previous;
  }
  return horizontal ?? vertical ?? previous;
}

/** Position (feet, in tiles) and facing of a moving character. */
export interface MoverState {
  x: number;
  y: number;
  facing: Facing;
}

/** What one input asks: a direction index (`DIRECTIONS`). */
export interface MovementInput {
  dir: number;
}

/** The tiles as movement sees them. Coordinates are whole tile coordinates. */
export interface MovementWorld {
  /** Whether tile (x, y) blocks movement; outside the map (or not loaded) it does. */
  isSolid(x: number, y: number): boolean;
  /** Speed multiplier on tile (x, y) (1 = normal). */
  speedFactor(x: number, y: number): number;
}

export interface MovementConfig {
  speedTilesPerSecond: number;
  hitboxSizeTiles: number;
}

const SLOTS: readonly TileSlot[] = ['ground', 'floor', 'object'];

/**
 * Movement view of a tile store. `isKnown` tells whether a tile exists (inside the map and loaded);
 * a tile is solid when any of its slots blocks (`tileBlocks`: an open door does not, given the meta of
 * the tile from `metaAt`). The speed factor is the floor's, or else the ground's.
 */
export function createMovementWorld(
  tileAt: (x: number, y: number, slot: TileSlot) => TileDef | undefined,
  isKnown: (x: number, y: number) => boolean,
  metaAt: (x: number, y: number) => TileMeta | undefined = () => undefined,
): MovementWorld {
  const blocks = (x: number, y: number, slot: TileSlot) => {
    const tile = tileAt(x, y, slot);
    return tile !== undefined && tileBlocks(tile, tile.door ? metaAt(x, y) : undefined);
  };
  return {
    isSolid: (x, y) => !isKnown(x, y) || SLOTS.some((slot) => blocks(x, y, slot)),
    speedFactor: (x, y) => (tileAt(x, y, 'floor') ?? tileAt(x, y, 'ground'))?.speedFactor ?? 1,
  };
}

/** Margin that keeps a box flush against a tile edge from counting as inside the tile. */
const EDGE_EPSILON = 1e-6;

/** First and last tile coordinates covered by the span [from, to] (edges excluded). */
function tilesCovered(from: number, to: number): [number, number] {
  return [Math.floor(from + EDGE_EPSILON), Math.floor(to - EDGE_EPSILON)];
}

/**
 * Moves the box (half size `half`, centered on `along`, `across`) by `delta` on one axis, stopping flush
 * against the first solid tile. `solidAt(a, b)` reads the tile at `a` on the moving axis and `b` across.
 */
function sweep(
  along: number,
  across: number,
  delta: number,
  half: number,
  solidAt: (a: number, b: number) => boolean,
): number {
  if (delta === 0) {
    return along;
  }
  const [first, last] = tilesCovered(across - half, across + half);
  const isBlocked = (a: number) => {
    for (let b = first; b <= last; b++) {
      if (solidAt(a, b)) {
        return true;
      }
    }
    return false;
  };
  const target = along + delta;
  if (delta > 0) {
    const edge = tilesCovered(along - half, along + half)[1];
    const reach = tilesCovered(target - half, target + half)[1];
    for (let a = edge + 1; a <= reach; a++) {
      if (isBlocked(a)) {
        return a - half;
      }
    }
  } else {
    const edge = tilesCovered(along - half, along + half)[0];
    const reach = tilesCovered(target - half, target + half)[0];
    for (let a = edge - 1; a >= reach; a--) {
      if (isBlocked(a)) {
        return a + 1 + half;
      }
    }
  }
  return target;
}

/**
 * One step of movement: `dt` seconds in the direction of `input`. Free in 8 directions with normalized
 * diagonals; the square box of the character (centered on its feet) stops against solid tiles and
 * slides along them, one axis after the other. The tile under the feet scales the speed. Deterministic:
 * the server and the client prediction get the same result.
 */
export function stepMovement(
  state: MoverState,
  input: MovementInput,
  dt: number,
  world: MovementWorld,
  config: MovementConfig = PLAYER,
): MoverState {
  const [dx, dy] = DIRECTIONS[input.dir] ?? [0, 0];
  const facing = facingAfter(input.dir, state.facing);
  if (dx === 0 && dy === 0) {
    return { ...state, facing };
  }
  const diagonal = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
  const speed =
    config.speedTilesPerSecond * world.speedFactor(Math.floor(state.x), Math.floor(state.y));
  const distance = speed * dt * diagonal;
  const half = config.hitboxSizeTiles / 2;
  const x = sweep(state.x, state.y, dx * distance, half, (a, b) => world.isSolid(a, b));
  const y = sweep(state.y, x, dy * distance, half, (a, b) => world.isSolid(b, a));
  return { x, y, facing };
}

/**
 * Pushes the square box of a character (centered on its feet) by (`dx`, `dy`) tiles, one axis after the
 * other, stopping flush against solid tiles: the knockback of a hit. Its facing does not change.
 */
export function pushMover(
  state: MoverState,
  dx: number,
  dy: number,
  world: MovementWorld,
  hitboxSizeTiles: number = PLAYER.hitboxSizeTiles,
): MoverState {
  const half = hitboxSizeTiles / 2;
  const x = sweep(state.x, state.y, dx, half, (a, b) => world.isSolid(a, b));
  const y = sweep(state.y, x, dy, half, (a, b) => world.isSolid(b, a));
  return { ...state, x, y };
}
