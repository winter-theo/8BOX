import { describe, expect, it } from 'vitest';
import { damageBarFill } from './DamageBars';

describe('damageBarFill', () => {
  it('fills the bar in proportion to the HP left, at least one pixel while some are left', () => {
    expect(damageBarFill(6, 6, 6)).toBe(6);
    expect(damageBarFill(3, 6, 6)).toBe(3);
    expect(damageBarFill(1, 6, 6)).toBe(1);
    expect(damageBarFill(1, 100, 6)).toBe(1);
    expect(damageBarFill(0, 6, 6)).toBe(0);
    expect(damageBarFill(9, 6, 6)).toBe(6);
  });
});
