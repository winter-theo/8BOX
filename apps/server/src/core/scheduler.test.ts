import { describe, expect, it } from 'vitest';
import { Scheduler } from './scheduler';

function createScheduler() {
  const errors: string[] = [];
  const scheduler = new Scheduler({
    tickMs: 50,
    onError: (_error, name) => errors.push(name),
  });
  const runUntil = (lastTick: number) => {
    for (let tick = scheduler.currentTick + 1; tick <= lastTick; tick++) {
      scheduler.runTick(tick);
    }
  };
  return { scheduler, errors, runUntil };
}

describe('Scheduler', () => {
  it('runs a periodic task every N seconds, rounded to ticks', () => {
    const { scheduler, runUntil } = createScheduler();
    const runs: number[] = [];
    scheduler.every(1000, () => runs.push(scheduler.currentTick));

    runUntil(65);

    expect(runs).toEqual([20, 40, 60]);
  });

  it('runs a delayed task once, N ticks later', () => {
    const { scheduler, runUntil } = createScheduler();
    const runs: number[] = [];
    runUntil(4);
    scheduler.inTicks(3, () => runs.push(scheduler.currentTick));

    runUntil(20);

    expect(runs).toEqual([7]);
    expect(scheduler.size).toBe(0);
  });

  it('converts a delay in ms to ticks', () => {
    const { scheduler, runUntil } = createScheduler();
    const runs: number[] = [];
    scheduler.after(120, () => runs.push(scheduler.currentTick)); // 2.4 ticks → 2
    scheduler.after(10, () => runs.push(scheduler.currentTick)); // at least the next tick

    runUntil(5);

    expect(runs).toEqual([1, 2]);
  });

  it('does not run cancelled tasks', () => {
    const { scheduler, runUntil } = createScheduler();
    const runs: string[] = [];
    const cancelDelayed = scheduler.inTicks(2, () => runs.push('delayed'));
    const cancelPeriodic = scheduler.everyTicks(1, () => {
      runs.push('periodic');
      if (scheduler.currentTick === 2) {
        cancelPeriodic();
      }
    });
    cancelDelayed();

    runUntil(5);

    expect(runs).toEqual(['periodic', 'periodic']);
    expect(scheduler.size).toBe(0);
  });

  it('runs a task scheduled during a tick on a later tick', () => {
    const { scheduler, runUntil } = createScheduler();
    const runs: number[] = [];
    scheduler.inTicks(1, () => {
      scheduler.inTicks(1, () => runs.push(scheduler.currentTick));
    });

    runUntil(1);
    expect(runs).toEqual([]);
    runUntil(2);
    expect(runs).toEqual([2]);
  });

  it('keeps running the other tasks when one throws', () => {
    const { scheduler, errors, runUntil } = createScheduler();
    const runs: string[] = [];
    scheduler.inTicks(
      1,
      () => {
        throw new Error('boom');
      },
      'faulty',
    );
    scheduler.inTicks(1, () => runs.push('ok'));

    runUntil(1);

    expect(errors).toEqual(['faulty']);
    expect(runs).toEqual(['ok']);
  });

  it('rejects a delay that is not a positive number of ticks', () => {
    const { scheduler } = createScheduler();
    expect(() => scheduler.inTicks(0, () => {})).toThrow(RangeError);
    expect(() => scheduler.everyTicks(1.5, () => {})).toThrow(RangeError);
  });
});
