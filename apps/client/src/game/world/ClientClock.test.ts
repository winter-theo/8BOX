import { describe, expect, it } from 'vitest';
import { ClientClock } from './ClientClock';

describe('ClientClock', () => {
  it('has no time before the first sending', () => {
    expect(new ClientClock().timeAt(0)).toBeUndefined();
  });

  it('runs the received clock at its scale', () => {
    const clock = new ClientClock(1000);
    clock.sync(5000, 60, 100);
    expect(clock.timeAt(100)).toBe(5000);
    expect(clock.timeAt(1100)).toBe(65_000);
  });

  it('blends into a new sending without jumping', () => {
    const clock = new ClientClock(1000);
    clock.sync(0, 1, 0);
    // The server says 9800 at 10 000: the running clock (10 000) is 200 ms ahead.
    clock.sync(9800, 1, 10_000);
    expect(clock.timeAt(10_000)).toBe(10_000);
    expect(clock.timeAt(10_500)).toBe(10_400);
    expect(clock.timeAt(11_000)).toBe(10_800);
    expect(clock.timeAt(12_000)).toBe(11_800);
  });

  it('forgets everything when cleared', () => {
    const clock = new ClientClock();
    clock.sync(1000, 1, 0);
    clock.clear();
    expect(clock.timeAt(0)).toBeUndefined();
  });
});
