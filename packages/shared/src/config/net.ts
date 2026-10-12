import { SECOND_MS } from './units';

export const NET = {
  /** Simulation and network tick rate of the server, in ticks per second. */
  tickRateHz: 20,
  /** Max radius of chunks a client is subscribed to around its player, in chunks. */
  maxSubscriptionRadiusChunks: 3,
  /** Max movement inputs accepted from a client, in inputs per second. */
  maxInputsPerSecond: 30,
  /** Largest WebSocket message accepted from a client, in bytes. */
  maxMessageBytes: 64 * 1024,
  /** Wait before the client tries to reconnect after losing the server, in ms. */
  reconnectDelayMs: 2 * SECOND_MS,
} as const;
