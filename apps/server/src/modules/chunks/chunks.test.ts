import {
  baseContent,
  type ChunkMessage,
  CONFIG,
  decodeChunk,
  LAYER,
  loadContent,
  PROTOCOL_VERSION,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, type FakeClient, settle } from '../../core/testing';
import { World } from '../../world/World';
import { playersModule } from '../players';
import { chunksModule } from './index';

const content = loadContent(baseContent);
/** 10 × 10 chunks: room to move away from the spawn. */
const world = World.generate({ seed: 4, content, layerSizeTiles: 320 });

function setup(devAuth = true) {
  const test = createTestContext({
    devAuth,
    content,
    world,
    modules: [playersModule, chunksModule],
  });
  const join = async (name: string) => {
    const client = connectFakeClient(test.ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    return client;
  };
  return { ...test, join };
}

const chunksOf = (client: FakeClient) =>
  client.received.filter((m): m is ChunkMessage => m.t === 'chunk');
const keyOf = (m: { cx: number; cy: number }) => `${m.cx},${m.cy}`;

describe('chunks module', () => {
  it('streams the chunks around the spawn, a few per tick, nearest first', async () => {
    const { tick, join } = setup();
    const client = await join('Ana');
    client.send({ t: 'viewport', w: 1280, h: 720, zoom: 4 });

    tick();
    expect(chunksOf(client)).toHaveLength(CONFIG.net.maxChunksPerTick);
    expect(chunksOf(client).map(keyOf).sort()).toEqual(['4,4', '4,5', '5,4', '5,5']);

    tick(10);
    expect(chunksOf(client)).toHaveLength(16); // chunks 3 → 6 on both axes
  });

  it('sends real chunk contents', async () => {
    const { tick, join } = setup();
    const client = await join('Ana');
    tick();

    const message = chunksOf(client)[0];
    const chunk = message && decodeChunk(message, content);
    const original = message && world.getChunk(LAYER.surface, message.cx, message.cy);
    expect(chunk?.ground).toEqual(original?.ground);
  });

  it('follows the debug camera: new chunks arrive, far ones are released', async () => {
    const { tick, join } = setup();
    const client = await join('Ana');
    client.send({ t: 'viewport', w: 1280, h: 720, zoom: 4 });
    tick(10);
    client.received.length = 0;

    client.send({ t: 'debugCamera', at: { x: 300, y: 160 } });
    tick(10);

    const unloaded = client.received.filter((m) => m.t === 'chunkUnload').map(keyOf);
    expect(unloaded).toContain('3,3');
    expect(chunksOf(client).map(keyOf)).toContain('9,5');
  });

  it('ignores the debug camera outside dev mode', async () => {
    const { ctx, tick } = setup(false);
    // Without dev mode nobody can join yet: spawn a session by hand.
    const client = connectFakeClient(ctx);
    client.session.state = 'playing';
    const entity = ctx.entities.create('player', {
      position: { layer: 0, x: world.spawn.x, y: world.spawn.y },
    });
    client.session.player = {
      entity,
      name: 'Ana',
      skin: 'default',
      position: { layer: 0, x: 0, y: 0 },
    };
    client.send({ t: 'viewport', w: 1280, h: 720, zoom: 4 });
    tick(10);
    client.received.length = 0;

    client.send({ t: 'debugCamera', at: { x: 300, y: 160 } });
    tick(10);

    expect(client.received).toEqual([]);
  });

  it('sends tile updates for subscribed chunks only', async () => {
    const { ctx, tick, join } = setup();
    const client = await join('Ana');
    tick(10);
    client.received.length = 0;

    ctx.world.setTile(LAYER.surface, 160, 160, 'object', 'base:berry_bush');
    ctx.world.setTile(LAYER.surface, 5, 5, 'object', 'base:flowers');
    ctx.world.setTile(LAYER.surface, 160, 160, 'object', null);

    expect(client.received).toEqual([
      { t: 'tileUpdate', layer: 0, x: 160, y: 160, slot: 'object', tile: 'base:berry_bush' },
      { t: 'tileUpdate', layer: 0, x: 160, y: 160, slot: 'object', tile: null },
    ]);
  });

  it('forgets a session once it is closed', async () => {
    const { ctx, tick, join } = setup();
    const client = await join('Ana');
    tick(2);

    ctx.net.handleClose(client.session);
    ctx.world.setTile(LAYER.surface, 160, 160, 'object', 'base:flowers');
    tick();

    expect(client.received.at(-1)?.t).toBe('chunk');
  });
});
