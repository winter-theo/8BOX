import { SECOND_MS } from './units';

export const PERSISTENCE = {
  /** Time between two saves of the modified chunks, in ms. */
  chunkSaveIntervalMs: 30 * SECOND_MS,
  /** Time between two saves of the connected characters, in ms (also saved on disconnect). */
  characterSaveIntervalMs: 60 * SECOND_MS,
  /** Chunks written to the database per statement, at most. */
  chunkWriteBatchSize: 100,
  /** Wait before writing again after a database error, in ms. */
  writeRetryDelayMs: 5 * SECOND_MS,
  /** On shutdown, longest wait for the last writes before quitting anyway, in ms. */
  shutdownFlushTimeoutMs: 10 * SECOND_MS,
} as const;
