import {
  type ActionTarget,
  addItems,
  CONFIG,
  type CraftStateMessage,
  countItem,
  emptyInventory,
  type GameConfig,
  type ItemStack,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { buildingModule } from '../building';
import { chunksModule } from '../chunks';
import { harvestModule } from '../harvest';
import { interactionModule } from '../interaction';
import { inventoryModule } from '../inventory';
import { movementModule } from '../movement';
import { playersModule } from '../players';
import { craftingModule } from './index';

const LOG = 'base:oak_log';
const PLANK = 'base:plank';
const STICK = 'base:stick';
const OAK = 'base:oak_tree';
const WORKBENCH = 'base:workbench';
const AXE = 'base:wooden_axe';
/** Ticks between two actions of a player (more than `actionCooldownMs`). */
const COOLDOWN_TICKS = 6;

/** A safe zone of 3 tiles around the spawn (the test world is only 64 tiles wide). */
const config: GameConfig = { ...CONFIG, world: { ...CONFIG.world, safeZoneRadiusTiles: 3 } };

function setup() {
  // Each message comes one second after the previous one: rate limits never get in the way.
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
      harvestModule,
      craftingModule,
      buildingModule,
    ],
    now: () => (clock += 1000),
  });
  const { ctx } = test;
  ctx.scheduler.every(1000, () => {
    for (const session of ctx.net.allSessions()) {
      ctx.net.handlePong(session);
    }
  });
  /** The spawn tile; the player stands 6 tiles to the right, out of the safe zone. */
  const X = Math.floor(ctx.world.spawn.x);
  const Y = Math.floor(ctx.world.spawn.y);
  // Nothing in the way around the player.
  for (let y = Y - 6; y <= Y + 6; y++) {
    for (let x = X; x <= X + 14; x++) {
      ctx.world.setTile(0, x, y, 'object', null);
    }
  }
  const ticksFor = (ms: number) => ctx.scheduler.ticksFor(ms);

  async function join(name: string, x = X + 6.5, y = Y + 0.5) {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const entity = client.session.player?.entity ?? -1;
    const moveTo = (to: { x: number; y: number }) =>
      ctx.entities.set(entity, 'position', { layer: 0, ...to });
    moveTo({ x, y });
    const inventory = () => ctx.entities.get(entity, 'inventory') ?? emptyInventory();
    return {
      client,
      entity,
      moveTo,
      inventory,
      hold(stacks: ItemStack[]) {
        let next = emptyInventory();
        for (const stack of stacks) {
          next = addItems(next, ctx.content.items, stack).inventory;
        }
        ctx.entities.set(entity, 'inventory', next);
      },
      /** Asks for a craft and returns what the server answers at once. */
      craft(recipe: string, count = 1): CraftStateMessage[] {
        const before = client.received.length;
        client.send({ t: 'craft', recipe, count });
        return crafts(client.received.slice(before));
      },
      /** Waits `ticks` ticks and returns the craft messages received meanwhile. */
      wait(ticks: number): CraftStateMessage[] {
        const before = client.received.length;
        test.tick(ticks);
        return crafts(client.received.slice(before));
      },
      /** Puts the first stack of an item in hand. */
      select(item: string) {
        const slot = inventory().slots.findIndex((stack) => stack?.item === item);
        client.send({ t: 'invSelect', slot });
      },
      /** Sends an action and waits out the cooldown; returns what the server answered meanwhile. */
      act(id: string, target: ActionTarget): ServerMessage[] {
        const before = client.received.length;
        client.send({ t: 'action', id, target });
        test.tick(COOLDOWN_TICKS);
        return client.received.slice(before);
      },
    };
  }

  return { ...test, join, X, Y, ticksFor };
}

function crafts(messages: readonly ServerMessage[]): CraftStateMessage[] {
  return messages.filter((message): message is CraftStateMessage => message.t === 'craft');
}

const tileAt = (x: number, y: number) => ({ kind: 'tile' as const, x, y });

describe('crafting module', () => {
  it('crafts by hand, one craft after the other, taking exactly the ingredients', async () => {
    const { join, ticksFor } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: LOG, count: 3 }]);

    expect(ana.craft(PLANK, 2)).toEqual([
      { t: 'craft', recipe: PLANK, outcome: 'started', durationMs: 500, left: 2 },
    ]);
    expect(countItem(ana.inventory(), LOG)).toBe(3);

    expect(ana.wait(ticksFor(500))).toEqual([
      { t: 'craft', recipe: PLANK, outcome: 'started', durationMs: 500, left: 1 },
    ]);
    expect(countItem(ana.inventory(), LOG)).toBe(2);
    expect(countItem(ana.inventory(), PLANK)).toBe(4);

    expect(ana.wait(ticksFor(500))).toEqual([{ t: 'craft', recipe: PLANK, outcome: 'done' }]);
    expect(countItem(ana.inventory(), LOG)).toBe(1);
    expect(countItem(ana.inventory(), PLANK)).toBe(8);
  });

  it('refuses without the ingredients, and changes nothing', async () => {
    const { join } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: PLANK, count: 7 }]);

    expect(ana.craft(WORKBENCH)).toEqual([
      { t: 'craft', recipe: WORKBENCH, outcome: 'refused', reason: 'missingItems' },
    ]);
    expect(ana.wait(20)).toEqual([]);
    expect(countItem(ana.inventory(), PLANK)).toBe(7);
    expect(countItem(ana.inventory(), WORKBENCH)).toBe(0);
  });

  it('needs a workbench within 3 tiles for its recipes', async () => {
    const { ctx, join, X, Y, ticksFor } = setup();
    const ana = await join('Ana');
    ana.hold([
      { item: PLANK, count: 6 },
      { item: STICK, count: 4 },
    ]);

    expect(ana.craft(AXE)[0]?.reason).toBe('noStation');
    // 4.5 tiles from the feet (X + 6.5) to the nearest edge of the tile.
    ctx.world.setTile(0, X + 11, Y, 'object', WORKBENCH);
    expect(ana.craft(AXE)[0]?.reason).toBe('noStation');

    ctx.world.setTile(0, X + 9, Y, 'object', WORKBENCH);
    expect(ana.craft(AXE)[0]?.outcome).toBe('started');
    expect(ana.wait(ticksFor(1500))).toEqual([{ t: 'craft', recipe: AXE, outcome: 'done' }]);
    expect(countItem(ana.inventory(), AXE)).toBe(1);
    expect(countItem(ana.inventory(), PLANK)).toBe(3);
    expect(countItem(ana.inventory(), STICK)).toBe(2);
  });

  it('checks the station again at the end of each craft', async () => {
    const { ctx, join, X, Y, ticksFor } = setup();
    const ana = await join('Ana');
    ana.hold([
      { item: PLANK, count: 6 },
      { item: STICK, count: 4 },
    ]);
    ctx.world.setTile(0, X + 8, Y, 'object', WORKBENCH);
    ana.craft(AXE);

    ctx.world.setTile(0, X + 8, Y, 'object', null);

    expect(ana.wait(ticksFor(1500))).toEqual([
      { t: 'craft', recipe: AXE, outcome: 'refused', reason: 'noStation' },
    ]);
    expect(countItem(ana.inventory(), PLANK)).toBe(6);
  });

  it('cancels the craft in progress when the player moves; the crafts done stay', async () => {
    const { join, X, Y, ticksFor } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: LOG, count: 3 }]);
    ana.craft(PLANK, 3);
    ana.wait(ticksFor(500));

    ana.moveTo({ x: X + 7, y: Y + 0.5 });

    expect(ana.wait(1)).toEqual([{ t: 'craft', recipe: PLANK, outcome: 'cancelled' }]);
    expect(ana.wait(ticksFor(1000))).toEqual([]);
    expect(countItem(ana.inventory(), LOG)).toBe(2);
    expect(countItem(ana.inventory(), PLANK)).toBe(4);
  });

  it('refuses when what the recipe gives does not fit in the inventory', async () => {
    const { join } = setup();
    const ana = await join('Ana');
    ana.hold([
      { item: STICK, count: 99 * 9 },
      { item: LOG, count: 2 },
    ]);

    expect(ana.craft(PLANK)).toEqual([
      { t: 'craft', recipe: PLANK, outcome: 'refused', reason: 'inventoryFull' },
    ]);
    expect(countItem(ana.inventory(), LOG)).toBe(2);
  });

  it('refuses an unknown recipe, and a second craft while one is in progress', async () => {
    const { join } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: LOG, count: 3 }]);

    expect(ana.craft('base:dragon')[0]?.reason).toBe('unknownRecipe');
    ana.craft(PLANK);
    expect(ana.craft(PLANK)[0]?.reason).toBe('busy');
  });

  it('from nothing: logs, planks, a workbench placed, then a wooden axe that cuts faster', async () => {
    const { ctx, join, X, Y, ticksFor } = setup();
    const ana = await join('Ana');
    const hitsToCut = (x: number) => {
      ctx.world.setTile(0, x, Y, 'object', OAK);
      let hits = 0;
      while (ctx.world.getTile(0, x, Y, 'object')?.id === OAK && hits < 20) {
        ana.act('cut', tileAt(x, Y));
        hits++;
      }
      return hits;
    };
    const craft = (recipe: string, count = 1) => {
      ana.craft(recipe, count);
      const timeMs = ctx.content.recipes.require(recipe).timeMs;
      ana.wait(ticksFor(timeMs) * count + 1);
    };

    // Two oaks by hand: at least 4 logs.
    expect(hitsToCut(X + 7)).toBe(6);
    expect(hitsToCut(X + 7)).toBe(6);
    expect(countItem(ana.inventory(), LOG)).toBeGreaterThanOrEqual(4);

    craft(PLANK, 4);
    craft(STICK);
    craft(WORKBENCH);
    expect(countItem(ana.inventory(), WORKBENCH)).toBe(1);
    expect(countItem(ana.inventory(), PLANK)).toBe(6);

    ana.select(WORKBENCH);
    ana.act('place', tileAt(X + 6, Y + 2));
    expect(ctx.world.getTile(0, X + 6, Y + 2, 'object')?.id).toBe(WORKBENCH);
    expect(countItem(ana.inventory(), WORKBENCH)).toBe(0);

    craft(AXE);
    expect(countItem(ana.inventory(), AXE)).toBe(1);
    ana.select(AXE);
    expect(hitsToCut(X + 7)).toBe(3);
  });

  it('wears the tool in hand at each hit and breaks it at 0, telling its owner', async () => {
    const { ctx, join, X, Y } = setup();
    const ana = await join('Ana');
    ana.hold([{ item: AXE, count: 1, durability: 2 }]);
    ctx.world.setTile(0, X + 7, Y, 'object', OAK);

    ana.act('cut', tileAt(X + 7, Y));
    expect(ana.inventory().slots[0]).toEqual({ item: AXE, count: 1, durability: 1 });

    const last = ana.act('cut', tileAt(X + 7, Y));
    expect(ana.inventory().slots[0]).toBeNull();
    expect(last).toContainEqual({ t: 'itemBroken', item: AXE });
  });
});
