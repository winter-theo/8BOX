import { describe, expect, it } from 'vitest';
import { GameLoop, type GameLoopOptions } from './loop';

function createLoop(overrides: Partial<GameLoopOptions> = {}) {
  const ticks: number[] = [];
  const loop = new GameLoop({
    tickMs: 50,
    maxCatchUpTicks: 5,
    statsWindowTicks: 3,
    onTick: (tick) => ticks.push(tick),
    onError: () => {},
    measure: () => 0,
    ...overrides,
  });
  return { loop, ticks };
}

describe('GameLoop', () => {
  it('runs one tick per elapsed tick duration, carrying the remainder over', () => {
    const { loop, ticks } = createLoop();

    expect(loop.update(0)).toBe(0);
    expect(loop.update(49)).toBe(0);
    expect(loop.update(50)).toBe(1);
    expect(loop.update(175)).toBe(2); // 125 ms more: two ticks, 25 ms kept
    expect(loop.update(200)).toBe(1); // 25 + 25 ms
    expect(ticks).toEqual([1, 2, 3, 4]);
  });

  it('bounds the catch-up and drops the rest of the lag', () => {
    const { loop, ticks } = createLoop();
    loop.update(0);

    expect(loop.update(1000)).toBe(5); // 20 ticks were due, only 5 run
    expect(loop.stats().skippedTicks).toBe(15);
    expect(loop.update(1050)).toBe(1); // back on the normal pace
    expect(ticks).toHaveLength(6);
  });

  it('measures the mean and the max of the recent tick durations', () => {
    let clock = 0;
    const durations = [2, 4, 6, 1];
    let i = 0;
    const { loop } = createLoop({
      measure: () => clock,
      onTick: () => {
        clock += durations[i++] ?? 0;
      },
    });
    loop.update(0);

    loop.update(200); // 4 ticks; the window keeps the last 3: 4, 6, 1 ms

    expect(loop.stats()).toEqual({ ticks: 4, avgMs: 11 / 3, maxMs: 6, skippedTicks: 0 });
  });

  it('keeps running when a tick throws', () => {
    const errors: number[] = [];
    const { loop } = createLoop({
      onTick: (tick) => {
        if (tick === 1) {
          throw new Error('boom');
        }
      },
      onError: (_error, tick) => errors.push(tick),
    });
    loop.update(0);

    expect(loop.update(100)).toBe(2);
    expect(errors).toEqual([1]);
  });

  it('ticks on real timers once started', async () => {
    const { loop, ticks } = createLoop({ tickMs: 5 });

    loop.start();
    await new Promise((resolve) => setTimeout(resolve, 60));
    loop.stop();

    expect(loop.running).toBe(false);
    expect(ticks.length).toBeGreaterThan(2);
  });
});
