import { describe, expect, it } from 'vitest';
import { lagFromQuery, touchFromQuery } from './urlOptions';

describe('lagFromQuery', () => {
  it('reads a whole number of milliseconds, capped', () => {
    expect(lagFromQuery('?lag=150')).toBe(150);
    expect(lagFromQuery('?protocol=3&lag=40')).toBe(40);
    expect(lagFromQuery('?lag=999999')).toBe(2000);
  });

  it('means no latency otherwise', () => {
    expect(lagFromQuery('')).toBe(0);
    expect(lagFromQuery('?lag=abc')).toBe(0);
    expect(lagFromQuery('?lag=-5')).toBe(0);
  });
});

describe('touchFromQuery', () => {
  it('forces the touch controls with touch=1 only', () => {
    expect(touchFromQuery('?touch=1')).toBe(true);
    expect(touchFromQuery('?lag=10&touch=1')).toBe(true);
    expect(touchFromQuery('?touch=0')).toBe(false);
    expect(touchFromQuery('')).toBe(false);
  });
});
