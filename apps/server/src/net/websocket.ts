import { NET } from '@8box/shared';
import type { FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';

export const WEBSOCKET_PATH = '/ws';

export interface WebSocketOptions {
  /** Browser origins allowed to connect. Clients without an Origin header (bots, tools) are accepted. */
  allowedOrigins: readonly string[];
}

/** Attaches a WebSocket endpoint to the Fastify HTTP server. */
export function attachWebSocket(app: FastifyInstance, options: WebSocketOptions): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: NET.maxMessageBytes });

  app.server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname !== WEBSOCKET_PATH) {
      socket.destroy();
      return;
    }
    const origin = request.headers.origin;
    if (origin !== undefined && !options.allowedOrigins.includes(origin)) {
      app.log.warn({ origin }, 'websocket rejected: origin not allowed');
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  wss.on('connection', (ws) => {
    ws.on('message', (data, isBinary) => {
      if (!isBinary && data.toString() === 'ping') {
        ws.send('pong');
      }
    });
  });

  app.addHook('preClose', async () => {
    for (const client of wss.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  return wss;
}
