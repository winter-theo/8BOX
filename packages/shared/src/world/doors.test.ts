import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/player';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import type { TileDef, TileSlot } from '../content/schemas';
import { createMovementWorld, type MoverState, stepMovement } from '../sim/movement';
import type { TileMeta } from './chunk';
import { doorMeta, isDoorOpen, tileBlocks } from './doors';

const content = loadContent(baseContent);
const def = (id: string) => content.tiles.get(id) as TileDef;

describe('doors', () => {
  it('keep their state in the meta of their tile: closed when absent', () => {
    expect(isDoorOpen(undefined)).toBe(false);
    expect(isDoorOpen(doorMeta(false))).toBe(false);
    expect(isDoorOpen(doorMeta(true))).toBe(true);
  });

  it('block when closed, and not when open', () => {
    const door = def('base:wooden_door');
    expect(tileBlocks(door, undefined)).toBe(true);
    expect(tileBlocks(door, doorMeta(true))).toBe(false);
    // Only a door opens.
    expect(tileBlocks(def('base:wooden_wall'), doorMeta(true))).toBe(true);
    expect(tileBlocks(def('base:wooden_floor'), undefined)).toBe(false);
  });

  it('stop a walker when closed and let them through when open', () => {
    // A door on (5, 5), grass everywhere else; the walker comes from below.
    const walk = (meta: TileMeta | undefined) => {
      const world = createMovementWorld(
        (x, y, slot: TileSlot) =>
          slot === 'ground'
            ? def('base:grass')
            : slot === 'object' && x === 5 && y === 5
              ? def('base:wooden_door')
              : undefined,
        () => true,
        (x, y) => (x === 5 && y === 5 ? meta : undefined),
      );
      let state: MoverState = { x: 5.5, y: 7.5, facing: 'up' };
      for (let i = 0; i < 40; i++) {
        state = stepMovement(state, { dir: 1 }, 0.05, world, PLAYER);
      }
      return state.y;
    };
    expect(walk(undefined)).toBeCloseTo(6.3);
    expect(walk(doorMeta(true))).toBeLessThan(5);
  });
});
