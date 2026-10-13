import { describe, expect, it } from 'vitest';
import { fadeToward } from './RoofLayer';

describe('fadeToward', () => {
  it('moves the alpha toward its target by the share of the fade time elapsed', () => {
    expect(fadeToward(1, 0, 50, 200)).toBeCloseTo(0.75);
    expect(fadeToward(0.75, 1, 100, 200)).toBeCloseTo(1);
    expect(fadeToward(0.1, 0, 50, 200)).toBe(0);
    expect(fadeToward(0.5, 1, 16, 0)).toBe(1);
  });
});
