/**
 * Drawing order of the world layers. Tall objects and entities (step 06) are sorted by their Y in world
 * pixels, so they use values from 0 upwards; the ground stays below them.
 */
export const DEPTH = {
  ground: -1,
} as const;
