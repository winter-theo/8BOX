import { PROTOCOL_VERSION } from '@8box/shared';
import { lagFromQuery } from './urlOptions';

const DEFAULT_SERVER_URL = 'http://localhost:3000';

/** Base HTTP URL of the game server; the WebSocket URL is derived from it. */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL || DEFAULT_SERVER_URL;

/** Clerk publishable key; undefined when Google sign-in is not set up (dev login only). */
export const CLERK_PUBLISHABLE_KEY: string | undefined =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined;

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

/** Dev only: simulated latency (`?lag=150` in the page URL). */
export const SIMULATED_LAG_MS = import.meta.env.DEV ? lagFromQuery(window.location.search) : 0;
