import { describe, expect, it } from 'vitest';
import { INTERACTION } from '../config/interaction';
import { aimedTile, distanceToTile, facingTile, subjectInReach, tileInReach } from './aim';

const reach = INTERACTION.reachTiles;

describe('distanceToTile', () => {
  it('is 0 inside the tile and measured to its nearest edge or corner outside', () => {
    expect(distanceToTile({ x: 10.5, y: 10.5 }, 10, 10)).toBe(0);
    expect(distanceToTile({ x: 10.5, y: 10.5 }, 12, 10)).toBeCloseTo(1.5);
    expect(distanceToTile({ x: 10.5, y: 10.5 }, 8, 10)).toBeCloseTo(1.5);
    expect(distanceToTile({ x: 10, y: 10 }, 11, 11)).toBeCloseTo(Math.SQRT2);
  });
});

describe('facingTile', () => {
  it('is the tile next to the tile of the feet, in the direction faced', () => {
    const feet = { x: 10.2, y: 20.9 };
    expect(facingTile(feet, 'up')).toEqual({ x: 10, y: 19 });
    expect(facingTile(feet, 'down')).toEqual({ x: 10, y: 21 });
    expect(facingTile(feet, 'left')).toEqual({ x: 9, y: 20 });
    expect(facingTile(feet, 'right')).toEqual({ x: 11, y: 20 });
  });

  it('is always in reach, wherever the feet are in their tile', () => {
    for (const x of [10, 10.01, 10.5, 10.99]) {
      for (const y of [20, 20.5, 20.99]) {
        for (const facing of ['up', 'down', 'left', 'right'] as const) {
          const tile = facingTile({ x, y }, facing);
          expect(tileInReach({ x, y }, tile.x, tile.y, reach), `${x},${y} ${facing}`).toBe(true);
        }
      }
    }
  });
});

describe('aimedTile', () => {
  const feet = { x: 10.5, y: 10.5 };

  it('is the tile in front of the player without a mouse (touch, keyboard)', () => {
    expect(aimedTile(feet, 'left', undefined, reach)).toEqual({ x: 9, y: 10 });
  });

  it('is the tile under the mouse when it is in reach, diagonals and own tile included', () => {
    expect(aimedTile(feet, 'left', { x: 11, y: 11 }, reach)).toEqual({ x: 11, y: 11 });
    expect(aimedTile(feet, 'left', { x: 10, y: 10 }, reach)).toEqual({ x: 10, y: 10 });
    expect(aimedTile(feet, 'down', { x: 10, y: 9 }, reach)).toEqual({ x: 10, y: 9 });
  });

  it('falls back to the tile in front when the mouse is out of reach', () => {
    expect(aimedTile(feet, 'down', { x: 13, y: 10 }, reach)).toEqual({ x: 10, y: 11 });
    expect(aimedTile(feet, 'up', { x: 12, y: 12 }, reach)).toEqual({ x: 10, y: 9 });
  });
});

describe('subjectInReach', () => {
  const feet = { x: 10.5, y: 10.5 };

  it('measures an entity through the tile under it, and always reaches oneself', () => {
    const entity = { kind: 'entity', id: 1, entity: 'groundItem', y: 10.5 } as const;
    expect(subjectInReach(feet, { ...entity, x: 12.9 }, reach)).toBe(true);
    expect(subjectInReach(feet, { ...entity, x: 13.1 }, reach)).toBe(false);
    expect(subjectInReach(feet, { kind: 'self' }, reach)).toBe(true);
  });

  it('refuses tiles two tiles away', () => {
    const tile = { kind: 'tile', tiles: {} } as const;
    expect(subjectInReach(feet, { ...tile, x: 11, y: 11 }, reach)).toBe(true);
    expect(subjectInReach(feet, { ...tile, x: 12, y: 12 }, reach)).toBe(false);
    expect(subjectInReach(feet, { ...tile, x: 10, y: 13 }, reach)).toBe(false);
  });
});
