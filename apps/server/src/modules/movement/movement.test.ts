import {
  CHUNK_SIZE,
  chunkCoord,
  directionOf,
  LAYER,
  PLAYER,
  PROTOCOL_VERSION,
  type SnapshotMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, type FakeClient } from '../../core/testing';
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

function lastSnapshot(client: FakeClient): SnapshotMessage | undefined {
  return client.received.findLast((message) => message.t === 'snapshot');
}

describe('movement module', () => {
  it('walks at the walking speed, one input per tick', () => {
    const { client, tick, spawn, position, dt } = setup();

    for (let seq = 0; seq < 20; seq++) {
      client.send({ t: 'input', seq, dir: RIGHT });
      tick();
    }

    expect(position().x).toBeCloseTo(spawn.x + SPEED * 20 * dt);
    expect(position().y).toBe(spawn.y);
    expect(lastSnapshot(client)).toMatchObject({
      ackSeq: 19,
      you: { x: position().x, y: spawn.y, facing: 'right' },
    });
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
    const { client, tick, spawn, position, dt } = setup();

    client.send({ t: 'input', seq: 5, dir: RIGHT });
    client.send({ t: 'input', seq: 5, dir: RIGHT });
    client.send({ t: 'input', seq: 3, dir: RIGHT });
    tick(3);

    expect(position().x).toBeCloseTo(spawn.x + SPEED * dt);
    expect(lastSnapshot(client)?.ackSeq).toBe(5);
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

  it('sends a snapshot every tick, with ackSeq -1 before any input', () => {
    const { client, tick, spawn } = setup();

    tick(2);

    const snapshots = client.received.filter((message) => message.t === 'snapshot');
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toMatchObject({
      ackSeq: -1,
      you: { x: spawn.x, y: spawn.y, facing: 'down' },
    });
  });
});
