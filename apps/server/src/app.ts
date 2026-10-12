import Fastify, { type FastifyServerOptions } from 'fastify';
import { healthRoutes } from './http/health';
import { attachWebSocket } from './net/websocket';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  allowedOrigins?: readonly string[];
}

/** Builds the HTTP + WebSocket server without listening, so tests can use `inject`. */
export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  app.register(healthRoutes);
  attachWebSocket(app, { allowedOrigins: options.allowedOrigins ?? [] });
  return app;
}
