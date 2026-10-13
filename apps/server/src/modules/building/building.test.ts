import {
  type ActionStateMessage,
  addItems,
  CONFIG,
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
      /** Places the item in hand on tile (x, y); returns the answer of the server. */
      place(tx: number, ty: number): ActionStateMessage[] {
        const before = client.received.length;
        client.send({ t: 'action', id: 'place', target: { kind: 'tile', x: tx, y: ty } });
        test.tick(COOLDOWN_TICKS);
        return client.received
          .slice(before)
          .filter((message): message is ActionStateMessage => message.t === 'action');
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
});
