import { DIRECTIONS } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { joystickDirection, knobOffset } from './joystickMath';

const RADIUS = 50;
const vector = (dx: number, dy: number) => DIRECTIONS[joystickDirection(dx, dy, RADIUS, 0.25)];

describe('joystickDirection', () => {
  it('moves nothing inside the dead zone', () => {
    expect(joystickDirection(0, 0, RADIUS, 0.25)).toBe(0);
    expect(joystickDirection(10, -5, RADIUS, 0.25)).toBe(0);
  });

  it('gives the four axes', () => {
    expect(vector(40, 0)).toEqual([1, 0]);
    expect(vector(-40, 0)).toEqual([-1, 0]);
    expect(vector(0, -40)).toEqual([0, -1]); // Up on the screen.
    expect(vector(0, 40)).toEqual([0, 1]);
  });

  it('gives the diagonals', () => {
    expect(vector(30, -30)).toEqual([1, -1]);
    expect(vector(-30, 30)).toEqual([-1, 1]);
  });

  it('snaps to the nearest of the 8 directions (45° sectors)', () => {
    // Sectors of 45° centered on each direction: up-right covers 22.5° to 67.5°.
    const at = (degrees: number) => {
      const radians = (degrees * Math.PI) / 180;
      return vector(40 * Math.cos(radians), -40 * Math.sin(radians));
    };
    expect(at(20)).toEqual([1, 0]);
    expect(at(25)).toEqual([1, -1]);
    expect(at(60)).toEqual([1, -1]);
    expect(at(70)).toEqual([0, -1]);
    expect(at(180)).toEqual([-1, 0]);
  });

  it('works beyond the radius', () => {
    expect(vector(500, 0)).toEqual([1, 0]);
  });
});

describe('knobOffset', () => {
  it('follows the thumb within the radius, and stops at its edge', () => {
    expect(knobOffset(10, 20, RADIUS)).toEqual({ x: 10, y: 20 });
    const far = knobOffset(300, 400, RADIUS);
    expect(far.x).toBeCloseTo(30);
    expect(far.y).toBeCloseTo(40);
  });
});
