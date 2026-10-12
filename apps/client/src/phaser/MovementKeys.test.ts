import { DIRECTIONS } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { directionFromKeys } from './MovementKeys';

const vector = (...codes: string[]) => DIRECTIONS[directionFromKeys(new Set(codes))];

describe('directionFromKeys', () => {
  it('reads WASD by physical position and the arrows', () => {
    expect(vector('KeyW')).toEqual([0, -1]);
    expect(vector('ArrowDown')).toEqual([0, 1]);
    expect(vector('KeyA')).toEqual([-1, 0]);
    expect(vector('ArrowRight')).toEqual([1, 0]);
  });

  it('combines two ways into a diagonal', () => {
    expect(vector('KeyW', 'KeyD')).toEqual([1, -1]);
    expect(vector('ArrowDown', 'KeyA')).toEqual([-1, 1]);
  });

  it('cancels opposite keys, and is still without keys', () => {
    expect(directionFromKeys(new Set(['KeyA', 'KeyD']))).toBe(0);
    expect(vector('KeyW', 'KeyS', 'KeyD')).toEqual([1, 0]);
    expect(directionFromKeys(new Set())).toBe(0);
    expect(directionFromKeys(new Set(['KeyZ', 'KeyQ']))).toBe(0);
  });
});
