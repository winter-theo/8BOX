import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import { WEBSOCKET_PATH } from './websocket';

type App = ReturnType<typeof buildApp>;

let app: App | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(allowedOrigins: string[] = []): Promise<string> {
  app = buildApp({ allowedOrigins });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const { port } = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${port}${WEBSOCKET_PATH}`;
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => resolve(data.toString()));
    ws.once('error', reject);
  });
}

function rejection(ws: WebSocket): Promise<Error> {
  return new Promise((resolve) => ws.once('error', resolve));
}

describe('WebSocket endpoint', () => {
  it('answers pong to ping', async () => {
    const ws = new WebSocket(await start());
    await new Promise((resolve) => ws.once('open', resolve));

    ws.send('ping');

    expect(await nextMessage(ws)).toBe('pong');
    ws.close();
  });

  it('accepts an allowed browser origin', async () => {
    const ws = new WebSocket(await start(['http://game.test']), { origin: 'http://game.test' });
    await new Promise((resolve) => ws.once('open', resolve));
    ws.close();
  });

  it('rejects a browser origin that is not allowed', async () => {
    const ws = new WebSocket(await start(['http://game.test']), { origin: 'http://evil.test' });

    const error = await rejection(ws);

    expect(error.message).toContain('403');
  });
});
