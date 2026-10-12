import {
  baseContent,
  chunkCoord,
  directionOf,
  LAYER,
  loadContent,
  PROTOCOL_VERSION,
  type SnapshotMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, type FakeClient, settle } from '../../core/testing';
import { World } from '../../world/World';
import { chunksModule } from '../chunks';
import { movementModule } from '../movement';
import { playersModule } from '../players';
import { snapshotsModule } from './index';

const content = loadContent(baseContent);
/** 10 × 10 chunks: room to be out of sight. */
const world = World.generate({ seed: 4, content, layerSizeTiles: 320 });

function setup() {
  // Network clock in step with the ticks (rate limits), and clients that answer the heartbeat.
  let now = 0;
  const test = createTestContext({
    devAuth: true,
    content,
    world,
    now: () => now,
    modules: [playersModule, movementModule, chunksModule, snapshotsModule],
  });
  const { ctx } = test;
  const clients: FakeClient[] = [];
  const join = async (name: string) => {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    client.send({ t: 'viewport', w: 1280, h: 720, zoom: 4 });
    clients.push(client);
    return client;
  };
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 1000 / ctx.config.net.tickRateHz;
      test.tick();
      for (const client of clients) {
        ctx.net.handlePong(client.session);
      }
    }
  };
  const entityOf = (client: FakeClient) => client.session.player?.entity ?? -1;
  const teleport = (client: FakeClient, x: number, y: number) => {
    ctx.entities.set(entityOf(client), 'position', { layer: LAYER.surface, x, y });
  };
  return { ctx, join, tick, entityOf, teleport };
}

const snapshotsOf = (client: FakeClient) =>
  client.received.filter((message): message is SnapshotMessage => message.t === 'snapshot');
const lastSnapshot = (client: FakeClient) => snapshotsOf(client).at(-1);

describe('snapshots module', () => {
  it('sends the player every tick, and no entity when alone', async () => {
    const { join, tick } = setup();
    const ana = await join('Ana');

    tick(2);

    expect(snapshotsOf(ana)).toHaveLength(2);
    expect(lastSnapshot(ana)).toEqual({
      t: 'snapshot',
      tick: 2,
      ackSeq: -1,
      you: { x: world.spawn.x, y: world.spawn.y, facing: 'down' },
      entities: [],
    });
  });

  it('shows the other players in its chunks, named the first time', async () => {
    const { join, tick, entityOf } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob');

    tick();
    expect(lastSnapshot(ana)?.entities).toEqual([
      {
        id: entityOf(bob),
        kind: 'player',
        x: world.spawn.x,
        y: world.spawn.y,
        facing: 'down',
        anim: 'idle',
        name: 'Bob',
      },
    ]);

    bob.send({ t: 'input', seq: 0, dir: directionOf(-1, 0) });
    tick();
    const [seen] = lastSnapshot(ana)?.entities ?? [];
    expect(seen).toMatchObject({ id: entityOf(bob), facing: 'left', anim: 'walk' });
    expect(seen?.name).toBeUndefined();
    expect(seen?.x).toBeLessThan(world.spawn.x);
    expect(lastSnapshot(bob)?.ackSeq).toBe(0);
  });

  it('never sends entities outside the chunks of the client, and tells when one leaves', async () => {
    const { ctx, join, tick, entityOf, teleport } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob');
    tick(10);
    expect(lastSnapshot(ana)?.entities.map((e) => e.id)).toEqual([entityOf(bob)]);

    // Far beyond the most chunks a client receives around its player.
    const farX = world.spawn.x + 150;
    teleport(bob, farX, world.spawn.y);
    tick();
    const farChunk = { layer: LAYER.surface, cx: chunkCoord(farX), cy: chunkCoord(world.spawn.y) };
    expect(ana.session.chunks?.has(farChunk)).toBe(false);
    expect(lastSnapshot(ana)?.entities).toEqual([]);
    expect(lastSnapshot(ana)?.gone).toEqual([entityOf(bob)]);

    tick(5);
    expect(lastSnapshot(ana)?.entities).toEqual([]);
    expect(lastSnapshot(ana)?.gone).toBeUndefined();
    // And Bob, far away, does not see Ana.
    expect(lastSnapshot(bob)?.entities).toEqual([]);

    teleport(bob, world.spawn.x + 1, world.spawn.y);
    tick();
    expect(lastSnapshot(ana)?.entities).toMatchObject([{ id: entityOf(bob), name: 'Bob' }]);
    expect(ctx.entities.size).toBe(2);
  });

  it('forgets a player who leaves', async () => {
    const { ctx, join, tick, entityOf } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob');
    tick();
    const bobEntity = entityOf(bob);

    ctx.net.handleClose(bob.session);
    tick();
    expect(lastSnapshot(ana)?.entities).toEqual([]);
    expect(lastSnapshot(ana)?.gone).toEqual([bobEntity]);
  });
});
