import { NET } from '@8box/shared';
import type { FastifyInstance } from 'fastify';
import { type RawData, type WebSocket, WebSocketServer } from 'ws';
import type { NetServer } from './net';

export const WEBSOCKET_PATH = '/ws';

export interface WebSocketOptions {
  /** Browser origins allowed to connect. Clients without an Origin header (bots, tools) are accepted. */
  allowedOrigins: readonly string[];
  /** Game sessions; without it the endpoint only accepts and drops connections (HTTP-only tests). */
  net: NetServer | undefined;
}

function toBytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data;
}

function waitForClose(clients: Iterable<WebSocket>, timeoutMs: number): Promise<void> {
  const closed = [...clients].map(
    (client) => new Promise<void>((resolve) => client.once('close', () => resolve())),
  );
  return Promise.race([
    Promise.all(closed).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Attaches the game WebSocket endpoint to the Fastify HTTP server and plugs sockets into `net`. */
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
    const net = options.net;
    if (!net) {
      ws.close(1001, 'no game');
      return;
    }
    const session = net.connect({
      send: (data) => ws.send(data),
      close: (code, reason) => ws.close(code, reason),
      ping: () => ws.ping(),
    });
    ws.on('message', (data, isBinary) => net.receive(session, toBytes(data), isBinary));
    ws.on('pong', () => net.handlePong(session));
    ws.on('close', () => net.handleClose(session));
    ws.on('error', (error) => app.log.debug({ err: error, session: session.id }, 'socket error'));
  });

  app.addHook('preClose', async () => {
    options.net?.closeAll('server shutting down');
    await waitForClose(wss.clients, NET.closeGraceMs);
    for (const client of wss.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  return wss;
}
