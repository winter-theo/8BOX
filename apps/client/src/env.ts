const DEFAULT_SERVER_URL = 'http://localhost:3000';

/** Base HTTP URL of the game server; the WebSocket URL is derived from it. */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL || DEFAULT_SERVER_URL;
