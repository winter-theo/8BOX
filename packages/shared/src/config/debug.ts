import { SECOND_MS } from './units';

export const DEBUG = {
  /** The server `debug` module logs the number of entities periodically. */
  entityCountLogEnabled: true,
  /** Time between two entity count logs, in ms. */
  entityCountLogIntervalMs: 10 * SECOND_MS,
} as const;
