import { describe, expect, it } from 'vitest';
import type { MovementWorld } from './movement';
import {
  createPathGrid,
  findPath,
  type PathGrid,
  type PathTile,
  type TilePoint,
  wallAhead,
} from './pathfinding';

/** A grid drawn with rows: `.` open, `W` wall, `#` blocked; outside the rows is blocked. */
function gridOf(rows: readonly string[]): PathGrid {
  const kinds: Record<string, PathTile> = { '.': 'open', W: 'wall', '#': 'blocked' };
  return { tileAt: (x, y) => kinds[rows[y]?.[x] ?? '#'] ?? 'blocked' };
}

/** Whether every step of a path goes to a neighbour (8 directions) of the previous tile. */
function isConnected(from: TilePoint, path: readonly TilePoint[]): boolean {
  let previous = from;
  for (const tile of path) {
    if (Math.max(Math.abs(tile.x - previous.x), Math.abs(tile.y - previous.y)) !== 1) {
      return false;
    }
    previous = tile;
  }
  return true;
}

const OPTIONS = { radiusTiles: 16 };

describe('findPath', () => {
  it('finds the straight and the diagonal way on open ground', () => {
    const grid = gridOf(['......', '......', '......', '......']);

    expect(findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, OPTIONS)).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 3, y: 3 }, OPTIONS)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
    expect(findPath(grid, { x: 2, y: 2 }, { x: 2, y: 2 }, OPTIONS)).toEqual([]);
  });

  it('goes around an obstacle, without cutting its corners', () => {
    const grid = gridOf([
      '.......', //
      '...#...',
      '...#...',
      '...#...',
      '.......',
    ]);
    const from = { x: 1, y: 2 };
    const path = findPath(grid, from, { x: 5, y: 2 }, OPTIONS);

    expect(path).toBeDefined();
    expect(isConnected(from, path ?? [])).toBe(true);
    expect(path?.every((tile) => grid.tileAt(tile.x, tile.y) === 'open')).toBe(true);
    // Around the end of the obstacle (row 0 or 4), never diagonally past its corner.
    expect(path?.some((tile) => tile.x === 3 && (tile.y === 0 || tile.y === 4))).toBe(true);
    expect(path).toHaveLength(6);
  });

  it('finds no path to a target it cannot reach, nor beyond its search square', () => {
    const enclosed = gridOf([
      '.......', //
      '.#####.',
      '.#...#.',
      '.#####.',
      '.......',
    ]);
    expect(findPath(enclosed, { x: 0, y: 0 }, { x: 3, y: 2 }, OPTIONS)).toBeUndefined();
    expect(findPath(enclosed, { x: 0, y: 0 }, { x: 3, y: 1 }, OPTIONS)).toBeUndefined();

    const open = gridOf(['.'.repeat(40)]);
    expect(findPath(open, { x: 0, y: 0 }, { x: 30, y: 0 }, { radiusTiles: 10 })).toBeUndefined();
    expect(findPath(open, { x: 0, y: 0 }, { x: 10, y: 0 }, { radiusTiles: 10 })).toHaveLength(10);
  });

  it('never crosses a wall without a wall cost, and breaks through when it is the only way', () => {
    const room = gridOf([
      '.......', //
      '.WWWWW.',
      '.W...W.',
      '.WWWWW.',
      '.......',
    ]);
    const from = { x: 3, y: 4 };
    const target = { x: 3, y: 2 };

    expect(findPath(room, from, target, OPTIONS)).toBeUndefined();
    const path = findPath(room, from, target, { ...OPTIONS, wallCost: 8 });
    expect(path).toEqual([
      { x: 3, y: 3 },
      { x: 3, y: 2 },
    ]);
  });

  it('enters a wall straight only, and goes around when it is cheaper than breaking through', () => {
    const line = gridOf([
      '.....', //
      'WWWW.',
      '.....',
    ]);
    const from = { x: 0, y: 0 };
    const target = { x: 0, y: 2 };

    // Around: 10 steps, cheaper than a wall costing 12 (and the step after it).
    const around = findPath(line, from, target, { ...OPTIONS, wallCost: 12 });
    expect(around).toHaveLength(10);
    expect(around?.every((tile) => line.tileAt(tile.x, tile.y) === 'open')).toBe(true);
    // Through, when the wall costs less.
    const through = findPath(line, from, target, { ...OPTIONS, wallCost: 2 });
    expect(through).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
    // A wall is never entered diagonally: two straight steps rather than one diagonal one.
    const corner = gridOf(['.W', 'W.']);
    const straight = findPath(corner, { x: 0, y: 0 }, { x: 1, y: 1 }, { ...OPTIONS, wallCost: 2 });
    expect(straight).toHaveLength(2);
    expect(corner.tileAt(straight?.[0]?.x ?? 0, straight?.[0]?.y ?? 0)).toBe('wall');
  });
});

describe('wallAhead', () => {
  const grid = gridOf(['.W.']);

  it('is the next tile of the path when it is a wall, and nothing when the way is open', () => {
    expect(wallAhead([{ x: 1, y: 0 }], grid)).toEqual({ x: 1, y: 0 });
    expect(wallAhead([{ x: 2, y: 0 }], grid)).toBeUndefined();
    expect(wallAhead([], grid)).toBeUndefined();
    // A wall further on the path is hit only once the walker reaches it.
    expect(wallAhead([{ x: 0, y: 0 }, { x: 1, y: 0 }], grid)).toBeUndefined();
  });
});

describe('createPathGrid', () => {
  it('turns what blocks movement into a wall where it can be broken, else into a blocked tile', () => {
    const movement: MovementWorld = {
      isSolid: (x) => x > 0,
      speedFactor: () => 1,
    };
    const grid = createPathGrid(movement, (x) => x === 1);

    expect([0, 1, 2].map((x) => grid.tileAt(x, 0))).toEqual(['open', 'wall', 'blocked']);
  });
});
