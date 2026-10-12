import { SECOND_MS } from './units';

export const DEBUG = {
  /** The server `debug` module logs the number of entities periodically. */
  entityCountLogEnabled: true,
  /** Time between two entity count logs, in ms. */
  entityCountLogIntervalMs: 10 * SECOND_MS,
  /** Speed of the free debug camera (dev mode, arrow keys), in tiles per second. */
  cameraSpeedTilesPerSecond: 40,
  /** Shortest time between two debug camera positions sent to the server, in ms. */
  cameraSendIntervalMs: 100,
} as const;
