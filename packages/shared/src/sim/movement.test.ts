import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/player';
import {
  DIRECTIONS,
  directionOf,
  facingAfter,
  type MovementWorld,
  type MoverState,
  stepMovement,
} from './movement';

const SPEED = PLAYER.speedTilesPerSecond;
const HALF = PLAYER.hitboxSizeTiles / 2;
const DT = 0.05;

/** A world from rows of characters: '#' solid, '~' slow (× 0.5), anything else open; outside is solid. */
function grid(rows: string[]): MovementWorld {
  const at = (x: number, y: number) => rows[y]?.[x];
  return {
    isSolid: (x, y) => {
      const tile = at(x, y);
      return tile === undefined || tile === '#';
    },
    speedFactor: (x, y) => (at(x, y) === '~' ? 0.5 : 1),
  };
}

const OPEN = grid(Array.from({ length: 20 }, () => '.'.repeat(20)));

const dir = (dx: number, dy: number) => ({ dir: directionOf(dx, dy) });

function walk(state: MoverState, input: { dir: number }, steps: number, world: MovementWorld) {
  let current = state;
  for (let i = 0; i < steps; i++) {
    current = stepMovement(current, input, DT, world);
  }
  return current;
}

const start: MoverState = { x: 10.5, y: 10.5, facing: 'down' };

describe('directions', () => {
  it('has a still direction and the 8 directions, each found by its signs', () => {
    expect(DIRECTIONS).toHaveLength(9);
    expect(directionOf(0, 0)).toBe(0);
    for (const [index, [dx, dy]] of DIRECTIONS.entries()) {
      expect(directionOf(dx * 3, dy * 3)).toBe(index);
    }
  });
});

describe('stepMovement in the open', () => {
  it('moves at the walking speed along an axis', () => {
    const next = stepMovement(start, dir(1, 0), DT, OPEN);
    expect(next.x).toBeCloseTo(10.5 + SPEED * DT);
    expect(next.y).toBe(10.5);
  });

  it('normalizes diagonals: same distance as along an axis', () => {
    const next = stepMovement(start, dir(-1, 1), DT, OPEN);
    expect(Math.hypot(next.x - start.x, next.y - start.y)).toBeCloseTo(SPEED * DT);
    expect(next.x).toBeLessThan(start.x);
    expect(next.y).toBeGreaterThan(start.y);
  });

  it('keeps a constant speed: one second of steps covers the speed', () => {
    const next = walk({ ...start, x: 2.5 }, dir(1, 0), 20, OPEN);
    expect(next.x).toBeCloseTo(2.5 + SPEED);
  });

  it('does not move without a direction, or with an unknown one', () => {
    expect(stepMovement(start, { dir: 0 }, DT, OPEN)).toEqual(start);
    expect(stepMovement(start, { dir: 42 }, DT, OPEN)).toEqual(start);
  });
});

describe('stepMovement against solid tiles', () => {
  // A wall on column 12, rows 0 to 19.
  const wall = grid(Array.from({ length: 20 }, () => '............#.......'));

  it('stops flush against a solid tile', () => {
    const next = walk(start, dir(1, 0), 20, wall);
    expect(next.x).toBeCloseTo(12 - HALF);
    // Pushing on stays still.
    expect(stepMovement(next, dir(1, 0), DT, wall).x).toBe(next.x);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const flush = { ...start, x: 12 - HALF };
    const next = stepMovement(flush, dir(1, -1), DT, wall);
    expect(next.x).toBe(flush.x);
    expect(next.y).toBeCloseTo(flush.y - SPEED * DT * Math.SQRT1_2);
  });

  it('stops at the corner of a lone block and slides past it', () => {
    // Block at (12, 9): coming from below-left, heading up-right.
    const rows = Array.from({ length: 20 }, () => '.'.repeat(20));
    rows[9] = `${'.'.repeat(12)}#${'.'.repeat(7)}`;
    const block = grid(rows);
    // Just below the block and to its left: the box overlaps column 12 after moving right.
    const below: MoverState = { x: 11.9, y: 10 + HALF + 0.01, facing: 'up' };
    const next = walk(below, dir(1, -1), 10, block);
    // It may not enter the block: either it stays below it or it is left of it.
    const overlapsBlock =
      next.x + HALF > 12 && next.x - HALF < 13 && next.y + HALF > 9 && next.y - HALF < 10;
    expect(overlapsBlock).toBe(false);
    expect(next.x).toBeGreaterThan(below.x); // it slid along the block's bottom side
  });

  it('fits through a one-tile gap', () => {
    const rows = Array.from({ length: 20 }, () => '.'.repeat(20));
    rows[8] = '##########.#########';
    const gap = grid(rows);
    const next = walk({ x: 10.5, y: 10.5, facing: 'up' }, dir(0, -1), 20, gap);
    expect(next.y).toBeCloseTo(10.5 - SPEED);
  });

  it('never tunnels through a wall, even with a long step', () => {
    const next = stepMovement(start, dir(1, 0), 1, wall);
    expect(next.x).toBeCloseTo(12 - HALF);
  });

  it('treats outside the map as solid', () => {
    const next = walk({ x: 1, y: 1, facing: 'up' }, dir(-1, -1), 20, OPEN);
    expect(next.x).toBeCloseTo(HALF);
    expect(next.y).toBeCloseTo(HALF);
  });
});

describe('stepMovement speed factor', () => {
  it('halves the speed on a slow tile under the feet', () => {
    const water = grid(Array.from({ length: 20 }, () => '~'.repeat(20)));
    const next = stepMovement(start, dir(0, 1), DT, water);
    expect(next.y).toBeCloseTo(10.5 + SPEED * DT * 0.5);
  });
});

describe('facing', () => {
  it('follows the last direction moved in, and stays when still', () => {
    expect(facingAfter(directionOf(1, 0), 'down')).toBe('right');
    expect(facingAfter(directionOf(0, -1), 'right')).toBe('up');
    expect(facingAfter(0, 'left')).toBe('left');
  });

  it('keeps one side of a diagonal, otherwise takes the horizontal one', () => {
    expect(facingAfter(directionOf(1, -1), 'up')).toBe('up');
    expect(facingAfter(directionOf(1, -1), 'right')).toBe('right');
    expect(facingAfter(directionOf(1, -1), 'down')).toBe('right');
  });

  it('turns even when blocked', () => {
    const wall = grid(Array.from({ length: 20 }, () => '...........#........'));
    const flush = { x: 11 - HALF, y: 10.5, facing: 'down' as const };
    expect(stepMovement(flush, dir(1, 0), DT, wall)).toEqual({ ...flush, facing: 'right' });
  });
});
