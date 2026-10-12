import {
  baseContent,
  CHUNK_SIZE,
  chunkCoord,
  directionOf,
  LAYER,
  loadContent,
  PLAYER,
  PROTOCOL_VERSION,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext } from '../../core/testing';
import { World } from '../../world/World';
import { chunksModule } from '../chunks';
import { playersModule } from '../players';
import { movementModule } from './index';

const SPEED = PLAYER.speedTilesPerSecond;
const HALF = PLAYER.hitboxSizeTiles / 2;
const RIGHT = directionOf(1, 0);
/** Clear grass around the spawn, so that only the tiles a test places get in the way. */
const CLEARING_RADIUS = 12;

function setup() {
  const test = createTestContext({ devAuth: true, modules: [playersModule, movementModule] });
  const { ctx } = test;
  const dt = 1 / ctx.config.net.tickRateHz;
  const spawn = ctx.world.spawn;
  for (let y = Math.floor(spawn.y) - CLEARING_RADIUS; y <= spawn.y + CLEARING_RADIUS; y++) {
    for (let x = Math.floor(spawn.x) - CLEARING_RADIUS; x <= spawn.x + CLEARING_RADIUS; x++) {
      ctx.world.setTile(LAYER.surface, x, y, 'ground', 'base:grass');
      ctx.world.setTile(LAYER.surface, x, y, 'object', null);
    }
  }
  const client = connectFakeClient(ctx);
  client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
  const entity = client.session.player?.entity ?? -1;
  const position = () => ctx.entities.get(entity, 'position') ?? { layer: 0, x: NaN, y: NaN };
  return { ...test, dt, spawn, client, entity, position };
}

describe('movement module', () => {
  it('walks at the walking speed, one input per tick', () => {
    const { ctx, client, tick, spawn, entity, position, dt } = setup();

    for (let seq = 0; seq < 20; seq++) {
      client.send({ t: 'input', seq, dir: RIGHT });
      tick();
    }

    expect(position().x).toBeCloseTo(spawn.x + SPEED * 20 * dt);
    expect(position().y).toBe(spawn.y);
    expect(ctx.entities.get(entity, 'facing')).toBe('right');
    expect(ctx.entities.get(entity, 'anim')).toBe('walk');
    expect(ctx.entities.get(entity, 'inputAck')).toBe(19);

    tick(); // No input this tick: standing.
    expect(ctx.entities.get(entity, 'anim')).toBe('idle');
  });

  it('does not go faster when inputs are flooded', () => {
    const { client, tick, spawn, position, dt } = setup();
    const ticks = 10;

    let seq = 0;
    for (let i = 0; i < ticks; i++) {
      for (let burst = 0; burst < 3; burst++) {
        client.send({ t: 'input', seq: seq++, dir: RIGHT });
      }
      tick();
    }

    const travelled = position().x - spawn.x;
    expect(travelled).toBeCloseTo(SPEED * ticks * dt);
    // A big burst does not either: only the newest inputs wait, one is applied per tick.
    const before = position().x;
    for (let burst = 0; burst < 25; burst++) {
      client.send({ t: 'input', seq: seq++, dir: RIGHT });
    }
    tick(ticks);
    expect(position().x - before).toBeLessThanOrEqual(SPEED * ticks * dt + 1e-9);
    expect(client.closed).toBeUndefined();
  });

  it('stops against a tree and slides along it', () => {
    const { ctx, client, tick, spawn, position } = setup();
    const treeX = Math.floor(spawn.x) + 2;
    ctx.world.setTile(LAYER.surface, treeX, Math.floor(spawn.y), 'object', 'base:oak_tree');

    for (let seq = 0; seq < 20; seq++) {
      client.send({ t: 'input', seq, dir: RIGHT });
      tick();
    }
    expect(position().x).toBeCloseTo(treeX - HALF);

    // Pushing diagonally into the tree slides down along it.
    const blocked = position();
    client.send({ t: 'input', seq: 20, dir: directionOf(1, 1) });
    tick();
    expect(position().x).toBeCloseTo(blocked.x);
    expect(position().y).toBeGreaterThan(blocked.y);
  });

  it('ignores repeated and late inputs', () => {
    const { ctx, client, tick, spawn, entity, position, dt } = setup();

    client.send({ t: 'input', seq: 5, dir: RIGHT });
    client.send({ t: 'input', seq: 5, dir: RIGHT });
    client.send({ t: 'input', seq: 3, dir: RIGHT });
    tick(3);

    expect(position().x).toBeCloseTo(spawn.x + SPEED * dt);
    expect(ctx.entities.get(entity, 'inputAck')).toBe(5);
  });

  it('keeps the spatial index up to date when the player changes chunk', () => {
    const { ctx, client, tick, entity, position } = setup();
    const start = position();
    const startChunk = { layer: 0, cx: chunkCoord(start.x), cy: chunkCoord(start.y) };
    // Walk left into the previous chunk (the test world is 2 × 2 chunks, the spawn in the middle).
    const toEdge = start.x - startChunk.cx * CHUNK_SIZE;

    const ticks = Math.ceil(toEdge / (SPEED / ctx.config.net.tickRateHz)) + 1;
    for (let seq = 0; seq < ticks; seq++) {
      client.send({ t: 'input', seq, dir: directionOf(-1, 0) });
      tick();
    }

    expect(chunkCoord(position().x)).toBe(startChunk.cx - 1);
    expect(ctx.entities.inChunk(startChunk).has(entity)).toBe(false);
    expect(ctx.entities.inChunk({ ...startChunk, cx: startChunk.cx - 1 }).has(entity)).toBe(true);
  });

  it('makes the streamed chunks follow the player', () => {
    // 10 × 10 chunks, with a cleared corridor east of the spawn.
    const content = loadContent(baseContent);
    const world = World.generate({ seed: 4, content, layerSizeTiles: 320 });
    // Network clock in step with the ticks, so that 20 inputs per second stay under the rate limit.
    let now = 0;
    const test = createTestContext({
      devAuth: true,
      content,
      world,
      now: () => now,
      modules: [playersModule, movementModule, chunksModule],
    });
    const { ctx } = test;
    const tick = (count = 1) => {
      for (let i = 0; i < count; i++) {
        now += 1000 / ctx.config.net.tickRateHz;
        test.tick();
        ctx.net.handlePong(client.session); // A live client answers the heartbeat.
      }
    };
    const row = Math.floor(world.spawn.y);
    for (let x = Math.floor(world.spawn.x); x < world.layerSizeTiles; x++) {
      for (let y = row - 1; y <= row + 1; y++) {
        world.setTile(LAYER.surface, x, y, 'ground', 'base:grass');
        world.setTile(LAYER.surface, x, y, 'object', null);
      }
    }
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
    client.send({ t: 'viewport', w: 1280, h: 720, zoom: 4 });
    tick(10);
    const startChunk = chunkCoord(world.spawn.x);
    const received = () => new Set(client.received.flatMap((m) => (m.t === 'chunk' ? [m.cx] : [])));
    expect(received().has(startChunk + 3)).toBe(false);

    // Two chunks east, one input per tick.
    const ticks = (2 * CHUNK_SIZE) / (SPEED / ctx.config.net.tickRateHz);
    for (let seq = 0; seq < ticks; seq++) {
      client.send({ t: 'input', seq, dir: RIGHT });
      tick();
    }
    tick(10);

    const player = client.session.player?.entity ?? -1;
    expect(chunkCoord(ctx.entities.get(player, 'position')?.x ?? NaN)).toBe(startChunk + 2);
    expect(received().has(startChunk + 3)).toBe(true);
    const unloaded = client.received.flatMap((m) => (m.t === 'chunkUnload' ? [m.cx] : []));
    expect(unloaded).toContain(startChunk - 2);
  });
});
