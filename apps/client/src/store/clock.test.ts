import { TIME } from '@8box/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearClock, showClock, useClockStore } from './clock';

describe('clock store', () => {
  beforeEach(() => clearClock());

  it('shows the hour and the sun by day, the moon at night', () => {
    showClock(0);
    expect(useClockStore.getState().clock).toEqual({ hours: 6, minutes: 0, daytime: true });
    showClock(TIME.daytimeMs);
    expect(useClockStore.getState().clock).toEqual({ hours: 18, minutes: 0, daytime: false });
  });

  it('changes only when the shown minute changes', () => {
    showClock(0);
    const shown = useClockStore.getState().clock;
    showClock(1000); // Same minute (a game minute lasts 2.5 s).
    expect(useClockStore.getState().clock).toBe(shown);
  });

  it('hides without a world time', () => {
    showClock(0);
    showClock(undefined);
    expect(useClockStore.getState().clock).toBeNull();
  });
});
