import { VIEW } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { blinkVisible, swingAngle } from './swing';

describe('swing', () => {
  it('sweeps across the facing, from one side to the other', () => {
    expect(swingAngle('right', 0.5)).toBeCloseTo(0);
    expect(swingAngle('down', 0.5)).toBeCloseTo(Math.PI / 2);
    expect(swingAngle('left', 0.5)).toBeCloseTo(Math.PI);
    expect(swingAngle('up', 0.5)).toBeCloseTo(-Math.PI / 2);
    expect(swingAngle('right', 0)).toBeCloseTo(-Math.PI / 3);
    expect(swingAngle('right', 1)).toBeCloseTo(Math.PI / 3);
    expect(swingAngle('right', 2)).toBeCloseTo(Math.PI / 3);
  });

  it('blinks a hit character, hidden first', () => {
    expect(blinkVisible(0)).toBe(false);
    expect(blinkVisible(VIEW.hitBlinkIntervalMs)).toBe(true);
    expect(blinkVisible(2 * VIEW.hitBlinkIntervalMs)).toBe(false);
  });
});
