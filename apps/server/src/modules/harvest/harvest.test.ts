import {
  type ActionStateMessage,
  type ActionTarget,
  addItems,
  baseContent,
  CONFIG,
  type Content,
  countItem,
  emptyInventory,
  type GameConfig,
  type ItemStack,
  loadContent,
  PROTOCOL_VERSION,
  type ServerMessage,
  type TileDamageMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import type { EntityId } from '../../core/entities';
import type { ServerEvents } from '../../core/events';
import type { ServerContext } from '../../core/module';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { World } from '../../world/World';
import { chunksModule } from '../chunks';
import { interactionModule } from '../interaction';
import { inventoryModule } from '../inventory';
import { movementModule } from '../movement';
import { playersModule } from '../players';
import { harvestModule } from './index';

const OAK = 'base:oak_tree';
const LOG = 'base:oak_log';
const AXE = 'base:test_axe';
/** Ticks between two actions of a player (more than `actionCooldownMs`). */
const COOLDOWN_TICKS = 6;

/** A safe zone of 3 tiles around the spawn (the test world is only 64 tiles wide). */
const config: GameConfig = { ...CONFIG, world: { ...CONFIG.world, safeZoneRadiusTiles: 3 } };

/** The base content, with an axe of power 3 (tools come with step 17). */
function contentWithAxe(): Content {
  const items = [
    ...(baseContent.items as unknown[]),
    { id: AXE, sprite: 'item.axe', tool: { kind: 'axe', power: 3, durability: 60 } },
  ];
  return loadContent({ ...baseContent, items });
}

function setup(options: { world?: World } = {}) {
  // Each message comes one second after the previous one: rate limits never get in the way.
  let clock = 0;
  const test = createTestContext({
    devAuth: true,
    config,
    content: contentWithAxe(),
    ...(options.world && { world: options.world }),
    modules: [
      playersModule,
      movementModule,
      chunksModule,
      inventoryModule,
      interactionModule,
      harvestModule,
    ],
    now: () => (clock += 1000),
  });
  const { ctx } = test;
  // The fake clients answer the heartbeat, so that they stay through long waits.
  ctx.scheduler.every(1000, () => {
    for (const session of ctx.net.allSessions()) {
      ctx.net.handlePong(session);
    }
  });
  /** The spawn tile; tiles 6 to the right are out of the safe zone, in the clearing. */
  const X = Math.floor(ctx.world.spawn.x);
  const Y = Math.floor(ctx.world.spawn.y);

  async function join(name: string, x = X + 6.5, y = Y + 0.5) {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const entity = client.session.player?.entity ?? -1;
    moveTo(ctx, entity, x, y);
    return {
      client,
      entity,
      inventory: () => ctx.entities.get(entity, 'inventory') ?? emptyInventory(),
      /** Sends an action, waits out the cooldown, and returns what the server answered meanwhile. */
      act(id: string, target: ActionTarget): ServerMessage[] {
        const before = client.received.length;
        client.send({ t: 'action', id, target });
        test.tick(COOLDOWN_TICKS);
        return client.received.slice(before);
      },
      hold(stacks: ItemStack[]) {
        let inventory = emptyInventory();
        for (const stack of stacks) {
          inventory = addItems(inventory, ctx.content.items, stack).inventory;
        }
        ctx.entities.set(entity, 'inventory', inventory);
      },
    };
  }

  /** Puts an object on a tile. */
  const place = (x: number, y: number, tile: string | null) =>
    ctx.world.setTile(0, x, y, 'object', tile);

  return { ...test, join, place, X, Y };
}

function moveTo(ctx: ServerContext, entity: EntityId, x: number, y: number) {
  ctx.entities.set(entity, 'position', { layer: 0, x, y });
}

function states(messages: readonly ServerMessage[]): ActionStateMessage[] {
  return messages.filter((message): message is ActionStateMessage => message.t === 'action');
}

function damages(messages: readonly ServerMessage[]): TileDamageMessage[] {
  return messages.filter((message): message is TileDamageMessage => message.t === 'tileDamage');
}

/** Records the events of one kind. */
function record<K extends keyof ServerEvents>(ctx: ServerContext, name: K): ServerEvents[K][] {
  const seen: ServerEvents[K][] = [];
  ctx.events.on(name, (payload) => {
    seen.push(payload);
  });
  return seen;
}

const tileAt = (x: number, y: number) => ({ kind: 'tile' as const, x, y });

describe('harvest module', () => {
  it('cuts an oak bare-handed in 6 hits, showing its HP, then gives 2 to 4 logs', async () => {
    const { ctx, tick, join, place, X, Y } = setup();
    place(X + 7, Y, OAK);
    const ana = await join('Ana');
    tick(10); // The chunks reach the client.
    const broken = record(ctx, 'tile.broken');

    const hits = Array.from({ length: 5 }, () => ana.act('cut', tileAt(X + 7, Y)));
    expect(hits.flatMap(damages).map((damage) => damage.hp)).toEqual([5, 4, 3, 2, 1]);
    expect(damages(hits[0] ?? [])[0]).toEqual({
      t: 'tileDamage',
      layer: 0,
      x: X + 7,
      y: Y,
      hp: 5,
      maxHp: 6,
    });
    expect(ctx.world.getTile(0, X + 7, Y, 'object')?.id).toBe(OAK);
    expect(countItem(ana.inventory(), LOG)).toBe(0);

    const last = ana.act('cut', tileAt(X + 7, Y));
    expect(states(last)).toEqual([{ t: 'action', id: 'cut', outcome: 'done' }]);
    expect(last).toContainEqual({
      t: 'tileUpdate',
      layer: 0,
      x: X + 7,
      y: Y,
      slot: 'object',
      tile: null,
    });
    expect(ctx.world.getTile(0, X + 7, Y, 'object')).toBeUndefined();
    expect(countItem(ana.inventory(), LOG)).toBeGreaterThanOrEqual(2);
    expect(countItem(ana.inventory(), LOG)).toBeLessThanOrEqual(4);
    expect(broken).toEqual([
      { layer: 0, x: X + 7, y: Y, slot: 'object', tile: OAK, by: ana.entity },
    ]);
  });

  it('takes the power of the right tool per hit and reports the tool used', async () => {
    const { ctx, join, place, X, Y } = setup();
    place(X + 7, Y, OAK);
    const ana = await join('Ana');
    ana.hold([{ item: AXE, count: 1 }]);
    const used = record(ctx, 'tool.used');

    ana.act('cut', tileAt(X + 7, Y));
    expect(ctx.world.getTile(0, X + 7, Y, 'object')?.id).toBe(OAK);
    ana.act('cut', tileAt(X + 7, Y));
    expect(ctx.world.getTile(0, X + 7, Y, 'object')).toBeUndefined();
    expect(used).toEqual([
      { entity: ana.entity, item: AXE, slot: 0 },
      { entity: ana.entity, item: AXE, slot: 0 },
    ]);
  });

  it('drops the loot at the feet of the player when the inventory is full', async () => {
    const { ctx, join, place, X, Y } = setup();
    place(X + 7, Y, 'base:tall_grass');
    const ana = await join('Ana');
    ana.hold([{ item: 'base:stick', count: 99 * 10 }]);

    expect(states(ana.act('uproot', tileAt(X + 7, Y)))).toEqual([
      { t: 'action', id: 'uproot', outcome: 'done' },
    ]);
    const piles = [...ctx.entities.near(0, X + 6.5, Y + 0.5, 0.5)]
      .map((id) => ctx.entities.get(id, 'groundItem'))
      .filter((pile) => pile !== undefined);
    expect(piles.map((pile) => [pile.item, pile.count])).toEqual([['base:fiber', 1]]);
    expect(countItem(ana.inventory(), 'base:fiber')).toBe(0);
  });

  it('gives a single loot when two players hit the same tree', async () => {
    const { ctx, join, place, X, Y } = setup();
    place(X + 7, Y, OAK);
    const ana = await join('Ana');
    const bob = await join('Bob', X + 7.5, Y + 1.5);
    const broken = record(ctx, 'tile.broken');

    for (let i = 0; i < 3; i++) {
      ana.act('cut', tileAt(X + 7, Y));
      bob.act('cut', tileAt(X + 7, Y));
    }
    // The tree is gone: more hits do nothing.
    expect(states(ana.act('cut', tileAt(X + 7, Y)))).toEqual([
      { t: 'action', id: 'cut', outcome: 'refused', reason: 'unavailable' },
    ]);
    expect(broken.map((event) => event.by)).toEqual([bob.entity]);
    expect(countItem(ana.inventory(), LOG)).toBe(0);
    expect(countItem(bob.inventory(), LOG)).toBeGreaterThanOrEqual(2);
  });

  it('refuses to break anything in the safe zone, with the reason, except for an admin', async () => {
    const { join, place, X, Y } = setup();
    place(X + 1, Y, OAK);
    const ana = await join('Ana', X + 0.5, Y + 0.5);

    expect(states(ana.act('cut', tileAt(X + 1, Y)))).toEqual([
      { t: 'action', id: 'cut', outcome: 'refused', reason: 'safeZone' },
    ]);
    expect(damages(ana.client.received)).toEqual([]);

    const account = ana.client.session.account;
    ana.client.session.account = account && { ...account, role: 'admin' };
    expect(states(ana.act('cut', tileAt(X + 1, Y)))).toEqual([
      { t: 'action', id: 'cut', outcome: 'done' },
    ]);
    expect(damages(ana.client.received).map((damage) => damage.hp)).toEqual([5]);
  });

  it('gives a damaged tile its HP back after 30 s without a hit', async () => {
    const { ctx, tick, join, place, X, Y } = setup();
    place(X + 7, Y, OAK);
    const ana = await join('Ana');
    tick(10);
    ana.act('cut', tileAt(X + 7, Y));
    ana.act('cut', tileAt(X + 7, Y));
    ana.client.received.length = 0;

    tick(ctx.scheduler.ticksFor(config.harvest.hpRecoveryDelayMs) - 2 * COOLDOWN_TICKS);
    expect(damages(ana.client.received)).toEqual([]);
    tick(COOLDOWN_TICKS + 1);
    expect(damages(ana.client.received)).toEqual([
      { t: 'tileDamage', layer: 0, x: X + 7, y: Y, hp: 6, maxHp: 6 },
    ]);

    // The next hit starts from full HP again.
    expect(damages(ana.act('cut', tileAt(X + 7, Y))).map((damage) => damage.hp)).toEqual([5]);
  });

  it('uproots tall grass for fiber, and flowers for nothing', async () => {
    const { ctx, join, place, X, Y } = setup();
    place(X + 7, Y, 'base:tall_grass');
    place(X + 6, Y + 1, 'base:flowers');
    const ana = await join('Ana');

    ana.act('uproot', tileAt(X + 7, Y));
    ana.act('uproot', tileAt(X + 6, Y + 1));
    expect(ctx.world.getTile(0, X + 7, Y, 'object')).toBeUndefined();
    expect(ctx.world.getTile(0, X + 6, Y + 1, 'object')).toBeUndefined();
    expect(ana.inventory().slots.filter((slot) => slot !== null)).toEqual([
      { item: 'base:fiber', count: 1 },
    ]);
  });

  it('picks berries in a while, even in the safe zone; the bush grows them back in 10 min', async () => {
    const { ctx, tick, join, place, X, Y } = setup();
    place(X + 1, Y, 'base:berry_bush');
    const ana = await join('Ana', X + 0.5, Y + 0.5);

    expect(states(ana.act('pick', tileAt(X + 1, Y)))).toEqual([
      { t: 'action', id: 'pick', outcome: 'started', durationMs: config.harvest.pickDurationMs },
    ]);
    tick(ctx.scheduler.ticksFor(config.harvest.pickDurationMs));
    expect(states(ana.client.received).at(-1)).toEqual({
      t: 'action',
      id: 'pick',
      outcome: 'done',
    });
    const berries = countItem(ana.inventory(), 'base:berries');
    expect(berries).toBeGreaterThanOrEqual(1);
    expect(berries).toBeLessThanOrEqual(3);
    expect(ctx.world.getTile(0, X + 1, Y, 'object')?.id).toBe('base:berry_bush_picked');

    // Nothing more to pick until it grows back.
    expect(states(ana.act('pick', tileAt(X + 1, Y)))).toEqual([
      { t: 'action', id: 'pick', outcome: 'refused', reason: 'unavailable' },
    ]);
    tick(ctx.scheduler.ticksFor(10 * 60 * 1000));
    expect(ctx.world.getTile(0, X + 1, Y, 'object')?.id).toBe('base:berry_bush');
  });

  it('grows back the picked bushes of a saved world after a restart', () => {
    const content = contentWithAxe();
    const world = World.generate({ seed: 1, content, layerSizeTiles: 64 });
    world.setTile(0, 40, 40, 'object', 'base:berry_bush_picked');
    const { ctx, tick } = setup({ world });

    tick(ctx.scheduler.ticksFor(10 * 60 * 1000) - 1);
    expect(ctx.world.getTile(0, 40, 40, 'object')?.id).toBe('base:berry_bush_picked');
    tick(1);
    expect(ctx.world.getTile(0, 40, 40, 'object')?.id).toBe('base:berry_bush');
  });
});
