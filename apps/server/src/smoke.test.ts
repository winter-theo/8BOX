/**
 * Smoke test: the whole server (every module, the fixed-step loop, HTTP, WebSocket, the built client) on a
 * real port; only the database is replaced by memory. `/health` answers, the page is served, and a bot
 * signs in and walks.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  baseContent,
  type ClientMessage,
  decodeServerMessage,
  directionOf,
  encodeMessage,
  loadContent,
  NET,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from './app';
import { createGame, type Game } from './core/game';
import { MODULES } from './modules';
import { WEBSOCKET_PATH } from './net/websocket';
import { World } from './world/World';

/** A small world (2 × 2 chunks), quick to generate; the spawn clearing is in its middle. */
const WORLD_SIZE_TILES = 64;
const WORLD_SEED = 1;
/** The bot must have walked this far, in tiles. */
const WALK_TILES = 1;
const TIMEOUT_MS = 8000;
const INDEX = '<!doctype html><title>8Box</title>';

let game: Game;
let app: ReturnType<typeof buildApp>;
let baseUrl: string;
let clientDir: string;

beforeAll(async () => {
  clientDir = mkdtempSync(join(tmpdir(), '8box-smoke-'));
  writeFileSync(join(clientDir, 'index.html'), INDEX);
  const content = loadContent(baseContent);
  game = createGame({
    content,
    log: pino({ level: 'silent' }),
    world: World.generate({ seed: WORLD_SEED, content, layerSizeTiles: WORLD_SIZE_TILES }),
    modules: MODULES,
    devAuth: true,
  });
  app = buildApp({
    net: game.ctx.net,
    tickStats: () => game.stats(),
    serveClient: { dir: clientDir },
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  game.start();
  const { port } = app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  game?.stop();
  await app?.close();
  rmSync(clientDir, { recursive: true, force: true });
});

/** Signs in a bot that walks right, and resolves with where it started and where it got to. */
function walkingBot(
  name: string,
): Promise<{ from: { x: number; y: number }; to: { x: number; y: number } }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${baseUrl.replace('http', 'ws')}${WEBSOCKET_PATH}`);
    let from: { x: number; y: number } | undefined;
    let seq = 0;
    let inputs: ReturnType<typeof setInterval> | undefined;
    const send = (message: ClientMessage) => socket.send(encodeMessage(message));
    const finish = (error?: Error, to?: { x: number; y: number }) => {
      clearTimeout(timer);
      clearInterval(inputs);
      socket.close();
      if (error || !from || !to) {
        reject(error ?? new Error('no position'));
      } else {
        resolve({ from, to });
      }
    };
    const timer = setTimeout(() => finish(new Error('the bot did not walk in time')), TIMEOUT_MS);

    socket.on('open', () => send({ t: 'hello', version: PROTOCOL_VERSION, devName: name }));
    socket.on('error', (error) => finish(error));
    socket.on('message', (data) => {
      const message: ServerMessage = decodeServerMessage(new Uint8Array(data as Buffer));
      if (message.t === 'rejected') {
        finish(new Error(`rejected: ${message.reason}`));
      } else if (message.t === 'welcome') {
        from = { x: message.you.position.x, y: message.you.position.y };
        send({ t: 'viewport', w: 320, h: 180, zoom: 8 });
        inputs = setInterval(
          () => send({ t: 'input', seq: seq++, dir: directionOf(1, 0) }),
          NET.clientInputIntervalMs,
        );
      } else if (message.t === 'snapshot' && from && message.you.x - from.x >= WALK_TILES) {
        finish(undefined, { x: message.you.x, y: message.you.y });
      }
    });
  });
}

describe('smoke test', () => {
  it('answers /health with the running loop', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, protocol: PROTOCOL_VERSION });
  });

  it('serves the client on the same address', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(INDEX);
  });

  it(
    'lets a bot sign in and walk',
    async () => {
      const { from, to } = await walkingBot('smoke_bot');
      expect(to.x - from.x).toBeGreaterThanOrEqual(WALK_TILES);
      expect(to.y).toBeCloseTo(from.y, 5);
      const health = (await (await fetch(`${baseUrl}/health`)).json()) as {
        tick: { count: number };
      };
      expect(health.tick.count).toBeGreaterThan(0);
    },
    TIMEOUT_MS + 2000,
  );
});
