import {
  type ActionStateMessage,
  addItems,
  type Chunk,
  CONFIG,
  chunkCoord,
  countItem,
  emptyInventory,
  type GameConfig,
  type ItemStack,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import type { ServerEvents } from '../../core/events';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { chunksModule } from '../chunks';
import { interactionModule } from '../interaction';
import { inventoryModule } from '../inventory';
import { movementModule } from '../movement';
import { playersModule } from '../players';
import { buildingModule } from './index';

const WORKBENCH = 'base:workbench';
const FLOOR = 'base:wooden_floor';
const WALL = 'base:wooden_wall';
const DOOR = 'base:wooden_door';
/** Direction index of "up" (`DIRECTIONS`). */
const UP = 1;
/** Ticks between two actions of a player (more than `actionCooldownMs`). */
const COOLDOWN_TICKS = 6;

/** A safe zone of 3 tiles around the spawn (the test world is only 64 tiles wide). */
const config: GameConfig = { ...CONFIG, world: { ...CONFIG.world, safeZoneRadiusTiles: 3 } };

function setup() {
  let clock = 0;
  const test = createTestContext({
    devAuth: true,
    config,
    modules: [
      playersModule,
      movementModule,
      chunksModule,
      inventoryModule,
      interactionModule,
      buildingModule,
    ],
    now: () => (clock += 1000),
  });
  const { ctx } = test;
  const X = Math.floor(ctx.world.spawn.x);
  const Y = Math.floor(ctx.world.spawn.y);
  for (let y = Y - 4; y <= Y + 4; y++) {
    for (let x = X - 4; x <= X + 10; x++) {
      ctx.world.setTile(0, x, y, 'object', null);
    }
  }

  async function join(name: string, x = X + 6.5, y = Y + 0.5) {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const entity = client.session.player?.entity ?? -1;
    ctx.entities.set(entity, 'position', { layer: 0, x, y });
    let seq = 0;
    return {
      client,
      entity,
      inventory: () => ctx.entities.get(entity, 'inventory') ?? emptyInventory(),
      hold(stacks: ItemStack[]) {
        let next = emptyInventory();
        for (const stack of stacks) {
          next = addItems(next, ctx.content.items, stack).inventory;
        }
        ctx.entities.set(entity, 'inventory', next);
      },
      /** Does action `id` on tile (x, y); returns the answer of the server. */
      act(id: string, tx: number, ty: number): ActionStateMessage[] {
        const before = client.received.length;
        client.send({ t: 'action', id, target: { kind: 'tile', x: tx, y: ty } });
        test.tick(COOLDOWN_TICKS);
        return client.received
          .slice(before)
          .filter((message): message is ActionStateMessage => message.t === 'action');
      },
      /** Places the item in hand on tile (x, y); returns the answer of the server. */
      place(tx: number, ty: number): ActionStateMessage[] {
        return this.act('place', tx, ty);
      },
      /** Walks in direction `dir` for `ticks` ticks; returns where the player stands then. */
      walk(dir: number, ticks: number) {
        for (let i = 0; i < ticks; i++) {
          client.send({ t: 'input', seq: seq++, dir });
          test.tick(1);
        }
        return ctx.entities.get(entity, 'position') ?? { layer: 0, x: 0, y: 0 };
      },
      received: (): ServerMessage[] => client.received,
    };
  }

  return { ...test, join, X, Y };
}

describe('building module', () => {
  it('places the item in hand on a free tile and takes one from the hand', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana');
    tick(10); // The chunks reach the client.
    ana.hold([{ item: WORKBENCH, count: 2 }]);
    const placed: ServerEvents['tile.placed'][] = [];
    ctx.events.on('tile.placed', (event) => {
      placed.push(event);
    });

    expect(ana.place(X + 7, Y)).toEqual([{ t: 'action', id: 'place', outcome: 'done' }]);
    expect(ctx.world.getTile(0, X + 7, Y, 'object')?.id).toBe(WORKBENCH);
    expect(countItem(ana.inventory(), WORKBENCH)).toBe(1);
    expect(placed).toEqual([
      { layer: 0, x: X + 7, y: Y, slot: 'object', tile: WORKBENCH, by: ana.entity },
    ]);
    expect(ana.received()).toContainEqual({
      t: 'tileUpdate',
      layer: 0,
      x: X + 7,
      y: Y,
      slot: 'object',
      tile: WORKBENCH,
    });
  });

  it('places a floor in the floor slot, under the player too', async () => {
    const { ctx, join, X, Y } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: FLOOR, count: 4 }]);

    expect(ana.place(X + 6, Y)[0]?.outcome).toBe('done');
    expect(ctx.world.getTile(0, X + 6, Y, 'floor')?.id).toBe(FLOOR);
    expect(ana.place(X + 6, Y)[0]?.reason).toBe('occupied');
  });

  it('refuses a tile that holds an object, or where another player stands', async () => {
    const { ctx, join, X, Y } = setup();
    const ana = await join('Ana');
    await join('Bob', X + 7.5, Y + 0.5);
    ana.hold([{ item: WORKBENCH, count: 2 }]);
    ctx.world.setTile(0, X + 6, Y + 1, 'object', 'base:tall_grass');

    expect(ana.place(X + 6, Y + 1)).toEqual([
      { t: 'action', id: 'place', outcome: 'refused', reason: 'occupied' },
    ]);
    expect(ana.place(X + 7, Y)[0]?.reason).toBe('occupied');
    expect(ana.place(X + 6, Y)[0]?.reason).toBe('occupied'); // Ana herself.
    expect(countItem(ana.inventory(), WORKBENCH)).toBe(2);
  });

  it('builds nothing in the safe zone', async () => {
    const { ctx, join, X, Y } = setup();
    const ana = await join('Ana', X + 1.5, Y + 0.5);
    ana.hold([{ item: WORKBENCH, count: 1 }]);

    expect(ana.place(X + 2, Y)[0]?.reason).toBe('safeZone');
    expect(ctx.world.getTile(0, X + 2, Y, 'object')).toBeUndefined();
  });

  it('refuses when the item in hand is not placed', async () => {
    const { join, X, Y } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: 'base:oak_log', count: 1 }]);

    expect(ana.place(X + 7, Y)[0]?.reason).toBe('unavailable');
  });

  it('refuses a tile out of reach, and puts a wall on a floor', async () => {
    const { ctx, join, X, Y } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: WALL, count: 2 }]);
    ctx.world.setTile(0, X + 7, Y, 'floor', FLOOR);

    expect(ana.place(X + 9, Y)[0]?.reason).toBe('outOfReach');
    expect(ana.place(X + 7, Y)[0]?.outcome).toBe('done');
    expect(ctx.world.getTile(0, X + 7, Y, 'object')?.id).toBe(WALL);
    expect(ctx.world.getTile(0, X + 7, Y, 'floor')?.id).toBe(FLOOR);
  });

  it('builds a room whose door blocks when closed and lets through when open', async () => {
    const { ctx, tick, join, X, Y } = setup();
    for (let y = Y - 4; y <= Y + 2; y++) {
      for (let x = X + 4; x <= X + 8; x++) {
        ctx.world.setTile(0, x, y, 'ground', 'base:grass');
      }
    }
    // A wall line on row Y - 1 with a gap at X + 6, where the door goes.
    ctx.world.setTile(0, X + 5, Y - 1, 'object', WALL);
    ctx.world.setTile(0, X + 7, Y - 1, 'object', WALL);
    const ana = await join('Ana');
    tick(10); // The chunks reach the client.
    ana.hold([{ item: DOOR, count: 1 }]);
    expect(ana.place(X + 6, Y - 1)[0]?.outcome).toBe('done');

    // Closed: Ana walks up and stops against it (her box is 0.6 tiles wide).
    expect(ana.walk(UP, 8).y).toBeCloseTo(Y + 0.3);
    expect(ana.act('openDoor', X + 6, Y - 1)[0]?.outcome).toBe('done');
    expect(ctx.world.getMeta(0, X + 6, Y - 1)).toEqual({ open: true });
    expect(ana.received()).toContainEqual({
      t: 'tileMeta',
      layer: 0,
      x: X + 6,
      y: Y - 1,
      meta: { open: true },
    });
    expect(ana.act('openDoor', X + 6, Y - 1)[0]?.reason).toBe('unavailable');

    // Open: she walks through.
    expect(ana.walk(UP, 8).y).toBeLessThan(Y - 1);

    // Nobody closes it on someone standing in the doorway.
    ctx.entities.set(ana.entity, 'position', { layer: 0, x: X + 6.5, y: Y - 0.5 });
    expect(ana.act('closeDoor', X + 6, Y - 1)[0]?.reason).toBe('occupied');
    const bob = await join('Bob', X + 6.5, Y - 0.5);
    ctx.entities.set(ana.entity, 'position', { layer: 0, x: X + 6.5, y: Y + 0.5 });
    expect(ana.act('closeDoor', X + 6, Y - 1)[0]?.reason).toBe('occupied');
    ctx.entities.set(bob.entity, 'position', { layer: 0, x: X + 6.5, y: Y - 2.5 });
    expect(ana.act('closeDoor', X + 6, Y - 1)[0]?.outcome).toBe('done');
    expect(ctx.world.getMeta(0, X + 6, Y - 1)).toBeUndefined();
    expect(ana.received().at(-2)).toEqual({
      t: 'tileMeta',
      layer: 0,
      x: X + 6,
      y: Y - 1,
      meta: null,
    });
    expect(ana.walk(UP, 8).y).toBeCloseTo(Y + 0.3);
  });

  it('forgets the state of a door broken or replaced', async () => {
    const { ctx, X, Y } = setup();
    ctx.world.setTile(0, X + 6, Y, 'object', DOOR);
    ctx.world.setMeta(0, X + 6, Y, { open: true });
    ctx.world.setTile(0, X + 6, Y, 'object', null);
    expect(ctx.world.getMeta(0, X + 6, Y)).toBeUndefined();
  });

  it('makes the bed slept in the spawn point of the player, saved with the character', async () => {
    const { ctx, join, X, Y } = setup();
    ctx.world.setTile(0, X + 7, Y, 'object', 'base:bed');
    const ana = await join('Ana');

    expect(ana.act('sleep', X + 7, Y)).toEqual([{ t: 'action', id: 'sleep', outcome: 'done' }]);
    const bed = { layer: 0, x: X + 7, y: Y };
    expect(ctx.entities.get(ana.entity, 'spawnPoint')).toEqual(bed);
    expect(ana.act('sleep', X + 6, Y)[0]?.reason).toBe('unavailable');

    ctx.net.handleClose(ana.client.session);
    const playerId = ana.client.session.account?.playerId ?? -1;
    expect(ctx.persistence.character(playerId)?.spawnPoint).toEqual(bed);
    const again = await join('Ana');
    expect(ctx.entities.get(again.entity, 'spawnPoint')).toEqual(bed);
  });

  it('marks the chunk of a construction placed or broken as built by a player', async () => {
    const { ctx, join, X, Y } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: WORKBENCH, count: 1 }]);
    const chunkAt = (x: number, y: number) =>
      ctx.world.getChunk(0, chunkCoord(x), chunkCoord(y)) as Chunk;
    expect(chunkAt(X + 7, Y).hasPlayerBuild).toBe(false);

    ana.place(X + 7, Y);
    expect(chunkAt(X + 7, Y).hasPlayerBuild).toBe(true);

    const broken = { layer: 0 as const, slot: 'object' as const, by: ana.entity };
    ctx.events.emit('tile.broken', { ...broken, x: 2, y: 60, tile: 'base:oak_tree' });
    expect(chunkAt(2, 60).hasPlayerBuild).toBe(false);
    ctx.events.emit('tile.broken', { ...broken, x: 2, y: 60, tile: WALL });
    expect(chunkAt(2, 60).hasPlayerBuild).toBe(true);
  });
});
