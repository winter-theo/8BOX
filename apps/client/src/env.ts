import { PROTOCOL_VERSION } from '@8box/shared';

const DEFAULT_SERVER_URL = 'http://localhost:3000';

/** Base HTTP URL of the game server; the WebSocket URL is derived from it. */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL || DEFAULT_SERVER_URL;

/**
 * Protocol version announced in `hello`. Dev only: `?protocol=N` in the URL announces another one,
 * to try the "new version available" screen.
 */
function protocolVersionToSend(): number {
  if (!import.meta.env.DEV) {
    return PROTOCOL_VERSION;
  }
  const value = new URLSearchParams(window.location.search).get('protocol');
  return value !== null && /^\d+$/.test(value) ? Number(value) : PROTOCOL_VERSION;
}

export const PROTOCOL_VERSION_SENT = protocolVersionToSend();

/** Longest simulated latency accepted in the URL, in ms. */
const MAX_SIMULATED_LAG_MS = 2000;

/** Dev only: `?lag=150` in the URL simulates 150 ms of round trip latency (0 = none). */
function simulatedLagMs(): number {
  if (!import.meta.env.DEV) {
    return 0;
  }
  const value = new URLSearchParams(window.location.search).get('lag');
  return value !== null && /^d+$/.test(value) ? Math.min(Number(value), MAX_SIMULATED_LAG_MS) : 0;
}

export const SIMULATED_LAG_MS = simulatedLagMs();
