import { SECOND_MS } from './units';

export const DEBUG = {
  /** The server `debug` module logs the number of entities periodically. */
  entityCountLogEnabled: true,
  /** Time between two entity count logs, in ms. */
  entityCountLogIntervalMs: 10 * SECOND_MS,
  /** Speed of the test character followed by the debug camera (dev mode, arrow keys), in tiles per second. */
  cameraSpeedTilesPerSecond: 40,
  /** Its speed while Shift is held, to place it precisely (behind a tree…), in tiles per second. */
  cameraSlowSpeedTilesPerSecond: 3,
  /** Time between two FPS readings shown in the dev info, in ms. */
  fpsSampleIntervalMs: 500,
  /** Shortest time between two debug camera positions sent to the server, in ms. */
  cameraSendIntervalMs: 100,
} as const;
