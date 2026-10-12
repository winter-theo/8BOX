/**
 * Seeded pseudo-random generator (mulberry32). Same seed → same sequence, on the client and the server.
 * Shared code must use it instead of `Math.random`.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both included. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** Random element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** True with the given probability (0 = never, 1 = always). */
  chance(probability: number): boolean;
}

const UINT32_RANGE = 2 ** 32;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };

  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Invalid integer range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    pick(items) {
      if (items.length === 0) {
        throw new RangeError('Cannot pick from an empty list');
      }
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    chance(probability) {
      return next() < probability;
    },
  };
}

/** 32-bit FNV-1a hash, to turn a text seed (e.g. WORLD_SEED) into a numeric one. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
