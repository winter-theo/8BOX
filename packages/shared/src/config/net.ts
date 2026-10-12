import { SECOND_MS } from './units';

export const NET = {
  /** Simulation and network tick rate of the server, in ticks per second. */
  tickRateHz: 20,
  /** Max radius of chunks a client is subscribed to around its player, in chunks. */
  maxSubscriptionRadiusChunks: 3,
  /** Largest WebSocket message accepted from a client, in bytes. */
  maxMessageBytes: 64 * 1024,
  /**
   * Messages accepted per client and per type: `max` messages per `windowMs` (token bucket, bursts up
   * to `max`). Extra messages are ignored. Every client message type needs an entry.
   */
  rateLimits: {
    hello: { max: 3, windowMs: 10 * SECOND_MS },
    ping: { max: 5, windowMs: SECOND_MS },
    /** 30 movement inputs per second. */
    input: { max: 30, windowMs: SECOND_MS },
  },
  /** Ignored messages (invalid or over the limit) tolerated per window before disconnecting, in messages. */
  maxViolations: 50,
  /** Window of the violation count, in ms. */
  violationWindowMs: 10 * SECOND_MS,
  /** Time a new connection has to send its `hello`, in ms. */
  helloTimeoutMs: 10 * SECOND_MS,
  /** Interval of the WebSocket heartbeat that measures latency and drops dead connections, in ms. */
  heartbeatIntervalMs: 5 * SECOND_MS,
  /** On shutdown, time given to clients to acknowledge the close before their socket is cut, in ms. */
  closeGraceMs: SECOND_MS,
  /** Interval of the client `ping` messages used to show the ping, in ms. */
  clientPingIntervalMs: 2 * SECOND_MS,
  /** First wait before the client reconnects; doubled after each failure, in ms. */
  reconnectDelayMs: SECOND_MS,
  /** Longest wait between two reconnection attempts, in ms. */
  reconnectMaxDelayMs: 30 * SECOND_MS,
} as const;
