import Fastify, { type FastifyBaseLogger } from 'fastify';
import type { TickStats } from './core/loop';
import { healthRoutes } from './http/health';
import type { NetServer } from './net/net';
import { attachWebSocket } from './net/websocket';

export interface AppOptions {
  /** Shared with the game; no logs when omitted. */
  logger?: FastifyBaseLogger;
  allowedOrigins?: readonly string[];
  /** Game sessions behind the `/ws` endpoint. */
  net?: NetServer;
  /** Tick time statistics of the running game, shown by `/health`. */
  tickStats?: () => TickStats;
}

/** Builds the HTTP + WebSocket server without listening, so tests can use `inject`. */
export function buildApp(options: AppOptions = {}) {
  const app = Fastify(options.logger ? { loggerInstance: options.logger } : { logger: false });
  app.register(healthRoutes, { tickStats: options.tickStats });
  attachWebSocket(app, { allowedOrigins: options.allowedOrigins ?? [], net: options.net });
  return app;
}
