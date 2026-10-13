import type { AddressInfo } from 'node:net';
import {
  type ClientMessage,
  decodeServerMessage,
  encodeMessage,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import type { GameModule } from '../core/module';
import { createTestContext } from '../core/testing';
import { WEBSOCKET_PATH } from './websocket';

type App = ReturnType<typeof buildApp>;

const joinModule: GameModule = {
  id: 'test-join',
  init(ctx) {
    ctx.events.on('session.authenticated', ({ session }) => {
      session.player = {
        entity: ctx.entities.create('player'),
        name: session.name ?? '?',
        skin: 'default',
        position: { layer: 0, x: 0.5, y: 0.5 },
      };
    });
  },
};

let app: App | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(allowedOrigins: string[] = []) {
  const { ctx } = createTestContext({ devAuth: true, modules: [joinModule] });
  app = buildApp({ allowedOrigins, net: ctx.net });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const { port } = app.server.address() as AddressInfo;
  return { ctx, url: `ws://127.0.0.1:${port}${WEBSOCKET_PATH}` };
}

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

function nextMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => resolve(decodeServerMessage(data as Buffer)));
    ws.once('error', reject);
  });
}

const send = (ws: WebSocket, message: ClientMessage) => ws.send(encodeMessage(message));

describe('WebSocket endpoint', () => {
  it('runs the handshake and answers pings over a real socket', async () => {
    const { ctx, url } = await start();
    const ws = new WebSocket(url);
    await opened(ws);

    send(ws, { t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
    expect(await nextMessage(ws)).toMatchObject({ t: 'welcome', you: { name: 'Ana' } });
    send(ws, { t: 'ping', time: 7 });
    expect(await nextMessage(ws)).toEqual({ t: 'pong', time: 7 });
    expect(ctx.net.sessionCount).toBe(1);

    ws.close();
    await new Promise((resolve) => ws.once('close', resolve));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ctx.net.sessionCount).toBe(0);
  });

  it('closes the sockets cleanly on shutdown', async () => {
    const { url } = await start();
    const ws = new WebSocket(url);
    await opened(ws);
    const closed = new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)));

    await app?.close();
    app = undefined;

    expect(await closed).toBe(1001);
  });

  it('accepts an allowed browser origin', async () => {
    const { url } = await start(['http://game.test']);
    const ws = new WebSocket(url, { origin: 'http://game.test' });
    await opened(ws);
    ws.close();
  });

  it('rejects a browser origin that is not allowed', async () => {
    const { url } = await start(['http://game.test']);
    const ws = new WebSocket(url, { origin: 'http://evil.test' });

    const error = await new Promise<Error>((resolve) => ws.once('error', resolve));

    expect(error.message).toContain('403');
  });
});
