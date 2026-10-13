import { describe, expect, it } from 'vitest';
import { TIME } from '../config/time';
import { MINUTE_MS } from '../config/units';
import { clockTime, daylight, dayPhase, isDaytime, timeOfDay } from './time';

const { dayLengthMs, daytimeMs, twilightMs } = TIME;

describe('day/night cycle', () => {
  it('lasts 60 minutes: 30 of daytime, then 30 of nighttime', () => {
    expect(dayLengthMs).toBe(60 * MINUTE_MS);
    expect(isDaytime(0)).toBe(true);
    expect(isDaytime(daytimeMs - 1)).toBe(true);
    expect(isDaytime(daytimeMs)).toBe(false);
    expect(isDaytime(dayLengthMs - 1)).toBe(false);
    expect(isDaytime(dayLengthMs)).toBe(true);
  });

  it('wraps the world time into the day', () => {
    expect(timeOfDay(3 * dayLengthMs + 1234)).toBe(1234);
    expect(timeOfDay(-1)).toBe(dayLengthMs - 1);
  });

  it('goes through dawn, day, dusk and night', () => {
    expect(dayPhase(0)).toBe('dawn');
    expect(dayPhase(twilightMs - 1)).toBe('dawn');
    expect(dayPhase(twilightMs)).toBe('day');
    expect(dayPhase(daytimeMs)).toBe('dusk');
    expect(dayPhase(daytimeMs + twilightMs - 1)).toBe('dusk');
    expect(dayPhase(daytimeMs + twilightMs)).toBe('night');
    expect(dayPhase(dayLengthMs - 1)).toBe('night');
  });

  it('brightens through the dawn and darkens through the dusk, over 3 minutes', () => {
    expect(twilightMs).toBe(3 * MINUTE_MS);
    expect(daylight(0)).toBe(0);
    expect(daylight(twilightMs / 2)).toBeCloseTo(0.5);
    expect(daylight(twilightMs)).toBe(1);
    expect(daylight(daytimeMs - 1)).toBe(1);
    expect(daylight(daytimeMs)).toBe(1);
    expect(daylight(daytimeMs + twilightMs / 4)).toBeCloseTo(0.75);
    expect(daylight(daytimeMs + twilightMs)).toBe(0);
    expect(daylight(dayLengthMs - 1)).toBe(0);
  });

  it('switches at once without twilight', () => {
    const cycle = { dayLengthMs, daytimeMs, twilightMs: 0 };
    expect(daylight(0, cycle)).toBe(1);
    expect(daylight(daytimeMs, cycle)).toBe(0);
  });

  it('shows a 24-hour clock: 6:00 at dawn, 18:00 at dusk', () => {
    expect(clockTime(0)).toEqual({ hours: 6, minutes: 0 });
    expect(clockTime(daytimeMs)).toEqual({ hours: 18, minutes: 0 });
    expect(clockTime(dayLengthMs * 0.75)).toEqual({ hours: 0, minutes: 0 });
    expect(clockTime(dayLengthMs - 1)).toEqual({ hours: 5, minutes: 59 });
  });
});
