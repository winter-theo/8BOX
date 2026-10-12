import { SECOND_MS } from './units';

export const NET = {
  /** Simulation and network tick rate of the server, in ticks per second. */
  tickRateHz: 20,
  /** Max radius of chunks a client is subscribed to around its player, in chunks. */
  maxSubscriptionRadiusChunks: 3,
  /** Chunks loaded beyond the edge of the view, ahead of the camera, in chunks. */
  chunkPrefetchMarginChunks: 1,
  /** Extra distance before a chunk is released, so that it does not flicker at the border, in chunks. */
  chunkUnloadMarginChunks: 1,
  /** Chunks sent to one client per tick at most (the nearest first), in chunks. */
  maxChunksPerTick: 4,
  /** Largest WebSocket message accepted from a client, in bytes. */
  maxMessageBytes: 64 * 1024,
  /**
   * Messages accepted per client and per type: `max` messages per `windowMs` (token bucket, bursts up
   * to `max`). Extra messages are ignored. Every client message type needs an entry.
   */
  rateLimits: {
    hello: { max: 3, windowMs: 10 * SECOND_MS },
    ping: { max: 5, windowMs: SECOND_MS },
    /** 30 movement inputs per second (the client sends 20). */
    input: { max: 30, windowMs: SECOND_MS },
    viewport: { max: 5, windowMs: SECOND_MS },
    /** Dev mode only. */
    debugCamera: { max: 20, windowMs: SECOND_MS },
  },
  /** Interval of the client movement inputs, in ms (one per server tick). */
  clientInputIntervalMs: 50,
  /**
   * Inputs waiting to be applied per player, at most (one is applied per tick). Beyond, the oldest are
   * dropped so that a client sending too fast gains neither speed nor lag, in inputs.
   */
  maxQueuedInputs: 4,
  /** Client prediction: a server correction farther than this is applied at once, in tiles. */
  predictionSnapTiles: 2,
  /** Client prediction: time for a small correction to fade to about a third, in ms. */
  predictionSmoothingMs: 80,
  /** Other entities are drawn this far in the past, between two received snapshots, in ms. */
  interpolationDelayMs: 100,
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
