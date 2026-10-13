import { describe, expect, it } from 'vitest';
import { formatClock } from './Clock';

describe('formatClock', () => {
  it('writes hours and minutes on two digits', () => {
    expect(formatClock(6, 5)).toBe('06:05');
    expect(formatClock(18, 30)).toBe('18:30');
  });
});
