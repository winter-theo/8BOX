import { describe, expect, it } from 'vitest';
import { createRng, hashCoords, hashSeed, parseSeed } from './rng';

function sequence(seed: number, length = 20): number[] {
  const rng = createRng(seed);
  return Array.from({ length }, () => rng.next());
}

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(sequence(42)).toEqual(sequence(42));
  });

  it('produces different sequences for different seeds', () => {
    expect(sequence(1)).not.toEqual(sequence(2));
  });

  it('keeps next() in [0, 1)', () => {
    for (const value of sequence(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns integers within the inclusive range and reaches both ends', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(-2, 2);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('rejects an invalid integer range', () => {
    expect(() => createRng(1).int(5, 1)).toThrow(RangeError);
  });

  it('returns floats within [min, max)', () => {
    const rng = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const value = rng.float(10, 12);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThan(12);
    }
  });

  it('picks elements of the list and rejects an empty list', () => {
    const rng = createRng(5);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('handles chance extremes', () => {
    const rng = createRng(11);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });
});

describe('hashSeed', () => {
  it('is stable and distinguishes texts', () => {
    expect(hashSeed('8box')).toBe(hashSeed('8box'));
    expect(hashSeed('8box')).not.toBe(hashSeed('8Box'));
  });
});

describe('hashCoords', () => {
  it('is stable, in [0, 1) and spread out', () => {
    expect(hashCoords(7, 10, 20)).toBe(hashCoords(7, 10, 20));
    expect(hashCoords(7, 10, 20)).not.toBe(hashCoords(8, 10, 20));
    expect(hashCoords(7, 10, 20)).not.toBe(hashCoords(7, 20, 10));
    let sum = 0;
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        const value = hashCoords(7, x, y);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        sum += value;
      }
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1);
  });
});

describe('parseSeed', () => {
  it('keeps numbers and hashes texts', () => {
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed(' 42 ')).toBe(42);
    expect(parseSeed('forest')).toBe(hashSeed('forest'));
  });
});
