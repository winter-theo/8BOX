import { randomInt } from 'node:crypto';

/** A random 32-bit world seed, when WORLD_SEED is not set. */
export function randomSeed(): number {
  return randomInt(0, 2 ** 32);
}
