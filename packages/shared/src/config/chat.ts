import { SECOND_MS } from './units';

export const CHAT = {
  /** Proximity chat reaches players within this distance, in tiles. */
  proximityRadiusTiles: 16,
  /** Longest chat message, in characters. */
  maxMessageLength: 200,
  /** Max messages a player can send per window, in messages. */
  rateLimitMessages: 5,
  /** Length of the rate limit window, in ms. */
  rateLimitWindowMs: 10 * SECOND_MS,
} as const;
