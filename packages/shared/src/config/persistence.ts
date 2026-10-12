import { SECOND_MS } from './units';

export const PERSISTENCE = {
  /** Time between two saves of the modified chunks, in ms. */
  chunkSaveIntervalMs: 30 * SECOND_MS,
  /** Time between two saves of the connected characters, in ms (also saved on disconnect). */
  characterSaveIntervalMs: 60 * SECOND_MS,
} as const;
