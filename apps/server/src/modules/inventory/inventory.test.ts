import {
  type ClientMessage,
  CONFIG,
  countItem,
  emptyInventory,
  encodeMessage,
  type GameConfig,
  INVENTORY,
  type InventoryMessage,
  PROTOCOL_VERSION,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import type { EntityId } from '../../core/entities';
import type { ServerContext } from '../../core/module';
import { connectFakeClient, createTestContext, type FakeClient, settle } from '../../core/testing';
import { playersModule } from '../players';
import { inventoryModule } from './index';

const LOG = 'base:oak_log';
const GOLD = 'base:gold';
const BAG = 'base:fiber_bag';

function setup(options: { devAuth?: boolean; config?: GameConfig } = {}) {
  // Each message comes one second after the previous one: rate limits never get in the way.
  let clock = 0;
  const test = createTestContext({
    devAuth: options.devAuth ?? true,
    modules: [playersModule, inventoryModule],
    now: () => (clock += 1000),
    ...(options.config && { config: options.config }),
  });
  const { ctx } = test;

  async function join(name: string) {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const entity = client.session.player?.entity ?? -1;
    return {
      client,
      entity,
      inventory: () => ctx.entities.get(entity, 'inventory'),
      give: (item: string, count: number) => client.send({ t: 'devGive', item, count }),
    };
  }

  return { ...test, join };
}

/** Every copy of an item in the world: inventories and piles on the ground. */
function total(ctx: ServerContext, item: string): number {
  let count = 0;
  for (const entity of ctx.entities.query('inventory')) {
    const inventory = ctx.entities.get(entity, 'inventory');
    count += inventory ? countItem(inventory, item) : 0;
  }
  for (const entity of ctx.entities.query('groundItem')) {
    const pile = ctx.entities.get(entity, 'groundItem');
    count += pile?.item === item ? pile.count : 0;
  }
  return count;
}

function piles(ctx: ServerContext) {
  return ctx.entities.query('groundItem').map((id) => ({
    id,
    ...ctx.entities.get(id, 'groundItem'),
    position: ctx.entities.get(id, 'position'),
  }));
}

function inventoryMessages(client: FakeClient): InventoryMessage[] {
  return client.received.filter(
    (message): message is InventoryMessage => message.t === 'inventory',
  );
}

/** Puts a player's feet somewhere else (a test shortcut for walking there). */
function moveTo(ctx: ServerContext, entity: EntityId, x: number, y: number) {
  ctx.entities.set(entity, 'position', { layer: 0, x, y });
}

describe('inventory module', () => {
  it('gives a new player 10 empty slots and sends them after the welcome', async () => {
    const { tick, join } = setup();
    const ana = await join('Ana');
    expect(ana.inventory()?.slots).toEqual(Array(INVENTORY.mainSlots).fill(null));

    tick();

    expect(ana.client.received.map((message) => message.t)).toEqual(['welcome', 'inventory']);
    expect(ana.client.last()).toMatchObject({ t: 'inventory', purse: 0, selected: 0 });
  });

  it('gives items in dev mode only', async () => {
    const dev = setup();
    const ana = await dev.join('Ana');
    ana.give(LOG, 30);
    ana.give(GOLD, 120);
    expect(ana.inventory()?.slots[0]).toEqual({ item: LOG, count: 30 });
    expect(ana.inventory()?.purse).toBe(120);

    // Without dev mode nobody can join yet: spawn a session by hand.
    const { ctx } = setup({ devAuth: false });
    const bob = connectFakeClient(ctx);
    const entity = ctx.entities.create('player', {
      position: { layer: 0, x: 5, y: 5 },
      player: { name: 'Bob', playerId: 1 },
    });
    bob.session.state = 'playing';
    bob.session.player = { entity, name: 'Bob', skin: 'theo', position: { layer: 0, x: 5, y: 5 } };
    ctx.events.emit('player.joined', { entity, name: 'Bob' });
    bob.send({ t: 'devGive', item: LOG, count: 30 });
    expect(ctx.entities.get(entity, 'inventory')?.slots[0]).toBeNull();
  });

  it('selects, moves, splits and swaps, and sends the inventory once per tick', async () => {
    const { tick, join } = setup();
    const ana = await join('Ana');
    ana.give(LOG, 30);
    ana.give('base:berries', 5);
    tick();
    const sent = inventoryMessages(ana.client).length;

    ana.client.send({ t: 'invSelect', slot: 4 });
    ana.client.send({ t: 'invMove', from: 0, to: 4, count: 10 });
    ana.client.send({ t: 'invMove', from: 1, to: 0 });
    tick();

    expect(ana.inventory()?.slots.slice(0, 5)).toEqual([
      { item: 'base:berries', count: 5 },
      { item: LOG, count: 20 },
      null,
      null,
      { item: LOG, count: 10 },
    ]);
    expect(ana.inventory()?.selected).toBe(4);
    expect(inventoryMessages(ana.client)).toHaveLength(sent + 1);
    expect(ana.client.last()).toMatchObject({ t: 'inventory', selected: 4 });
  });

  it('wears a bag for 10 more slots', async () => {
    const { join } = setup();
    const ana = await join('Ana');
    ana.give(BAG, 1);

    ana.client.send({ t: 'invMove', from: 0, to: 'bag' });

    expect(ana.inventory()?.equipment.bag).toEqual({ item: BAG, count: 1 });
    expect(ana.inventory()?.slots).toHaveLength(INVENTORY.mainSlots + 10);
  });

  it('never creates nor duplicates items, whatever the client sends', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana');
    ana.give(LOG, 30);
    ana.give(GOLD, 50);
    tick();
    const before = ana.inventory();
    const sent = inventoryMessages(ana.client).length;

    const attempts: unknown[] = [
      { t: 'invMove', from: 0, to: 1, count: 31 },
      { t: 'invMove', from: 5, to: 1 },
      { t: 'invMove', from: 0, to: 0 },
      { t: 'invMove', from: 0, to: 25 },
      { t: 'invMove', from: 0, to: 'head' },
      { t: 'invMove', from: 0, to: 1, count: -5 },
      { t: 'invMove', from: 0, to: 1, count: 2.5 },
      { t: 'invMove', from: 0, to: 'purse' },
      { t: 'invDrop', from: 0, count: 31 },
      { t: 'invDrop', from: 3 },
      { t: 'invDrop', from: 'purse', count: 51 },
      { t: 'invSelect', slot: 12 },
      {
        t: 'inventory',
        slots: [{ item: LOG, count: 99 }],
        equipment: {},
        purse: 9999,
        selected: 0,
      },
    ];
    for (const attempt of attempts) {
      ana.client.sendRaw(encodeMessage(attempt as ClientMessage));
    }
    tick();

    expect(ana.inventory()).toEqual(before);
    expect(piles(ctx)).toEqual([]);
    // Refused operations send the inventory again, so that the client shows the truth.
    expect(inventoryMessages(ana.client).length).toBeGreaterThan(sent);

    // Dropping the same stack twice: the second drop finds an empty slot.
    ana.client.send({ t: 'invDrop', from: 0 });
    ana.client.send({ t: 'invDrop', from: 0 });
    expect(total(ctx, LOG)).toBe(30);
    expect(piles(ctx)).toHaveLength(1);
  });

  it('drops items in front of the player, who picks them back up only after 2 s', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana');
    ana.give(LOG, 12);
    const feet = ctx.entities.get(ana.entity, 'position');

    ana.client.send({ t: 'invDrop', from: 0, count: 5 });

    expect(ana.inventory()?.slots[0]).toEqual({ item: LOG, count: 7 });
    const [pile] = piles(ctx);
    expect(pile).toMatchObject({ item: LOG, count: 5, droppedBy: expect.any(Number) });
    expect(pile?.position).toEqual({ layer: 0, x: feet?.x, y: (feet?.y ?? 0) + 1 });

    moveTo(ctx, ana.entity, pile?.position?.x ?? 0, pile?.position?.y ?? 0);
    tick(ctx.scheduler.ticksFor(INVENTORY.dropPickupDelayMs) - 1);
    expect(piles(ctx)).toHaveLength(1);
    tick();
    expect(piles(ctx)).toEqual([]);
    expect(ana.inventory()?.slots[0]).toEqual({ item: LOG, count: 12 });
  });

  it('lets another player pick up a dropped item at once', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob');
    ana.give(LOG, 4);
    ana.give(GOLD, 300);
    moveTo(ctx, bob.entity, 10, 10);
    ana.client.send({ t: 'invDrop', from: 0 });
    ana.client.send({ t: 'invDrop', from: 'purse', count: 100 });
    const [pile] = piles(ctx);
    expect(piles(ctx)).toHaveLength(2);

    moveTo(ctx, bob.entity, pile?.position?.x ?? 0, (pile?.position?.y ?? 0) + 0.2);
    tick();

    expect(piles(ctx)).toEqual([]);
    expect(bob.inventory()?.slots[0]).toEqual({ item: LOG, count: 4 });
    expect(bob.inventory()?.purse).toBe(100);
    expect(ana.inventory()?.purse).toBe(200);
  });

  it('gives a pile two players reach in the same tick to only one of them', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob');
    const cid = await join('Cid');
    cid.give(LOG, 40);
    cid.client.send({ t: 'invDrop', from: 0 });
    const [pile] = piles(ctx);
    const x = pile?.position?.x ?? 0;
    const y = pile?.position?.y ?? 0;
    moveTo(ctx, cid.entity, x + 5, y);
    moveTo(ctx, ana.entity, x, y);
    moveTo(ctx, bob.entity, x + 0.1, y);

    tick();

    const counts = [ana, bob].map((player) =>
      countItem(player.inventory() ?? emptyInventory(), LOG),
    );
    expect(counts.sort()).toEqual([0, 40]);
    expect(piles(ctx)).toEqual([]);
    expect(total(ctx, LOG)).toBe(40);
  });

  it('leaves on the ground what does not fit in the inventory', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob');
    bob.give('base:berries', 99 * INVENTORY.mainSlots - 3);
    ana.give(LOG, 1);
    ana.give('base:berries', 10);
    moveTo(ctx, bob.entity, 5, 5);
    ana.client.send({ t: 'invDrop', from: 1 });
    const [pile] = piles(ctx);
    moveTo(ctx, bob.entity, pile?.position?.x ?? 0, pile?.position?.y ?? 0);

    tick();

    expect(piles(ctx)).toMatchObject([{ item: 'base:berries', count: 7 }]);
    expect(total(ctx, 'base:berries')).toBe(99 * INVENTORY.mainSlots + 7);
  });

  it('merges piles of the same item dropped close together', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana');
    ana.give(LOG, 10);
    ana.give('base:berries', 3);

    ana.client.send({ t: 'invDrop', from: 0, count: 4 });
    ana.client.send({ t: 'invDrop', from: 0, count: 6 });
    ana.client.send({ t: 'invDrop', from: 1 });

    expect(piles(ctx).map(({ item, count }) => ({ item, count }))).toEqual([
      { item: LOG, count: 10 },
      { item: 'base:berries', count: 3 },
    ]);
  });

  it('removes items left on the ground for too long', async () => {
    const lifetimeMs = 2000;
    const config = {
      ...CONFIG,
      inventory: { ...CONFIG.inventory, groundItemLifetimeMs: lifetimeMs },
    };
    const { ctx, tick, join } = setup({ config });
    const ana = await join('Ana');
    ana.give(LOG, 3);
    ana.client.send({ t: 'invDrop', from: 0 });

    tick(
      ctx.scheduler.ticksFor(lifetimeMs) -
        ctx.scheduler.ticksFor(INVENTORY.groundItemExpiryCheckMs),
    );
    expect(piles(ctx)).toHaveLength(1);
    tick(ctx.scheduler.ticksFor(INVENTORY.groundItemExpiryCheckMs) * 2);
    expect(piles(ctx)).toEqual([]);
  });

  it('saves the inventory with the character and gives it back on return', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana');
    ana.give(BAG, 1);
    ana.client.send({ t: 'invMove', from: 0, to: 'bag' });
    ana.give(LOG, 30);
    ana.give(GOLD, 77);
    ana.client.send({ t: 'invMove', from: 0, to: 15 });
    ana.client.send({ t: 'invSelect', slot: 3 });
    const before = ana.inventory();

    ctx.net.handleClose(ana.client.session);
    const back = await join('Ana');

    expect(back.inventory()).toEqual({ ...before, selected: 0 });
    expect(back.inventory()?.slots[15]).toEqual({ item: LOG, count: 30 });
    expect(back.inventory()?.purse).toBe(77);
  });
});

describe('inventory module: loot of monsters', () => {
  it('puts the items asked for on the ground where the monster died', () => {
    const { ctx } = createTestContext({ modules: [playersModule, inventoryModule] });
    const position = { layer: 0, x: 20.5, y: 20.5 };

    ctx.events.emit('items.drop', {
      position,
      items: [
        { item: 'base:gold', count: 3 },
        { item: 'base:slime_gel', count: 1 },
      ],
    });

    const piles = ctx.entities
      .query('groundItem')
      .map((id) => ({
        ...ctx.entities.get(id, 'groundItem'),
        at: ctx.entities.get(id, 'position'),
      }));
    expect(piles).toEqual([
      expect.objectContaining({ item: 'base:gold', count: 3, at: position }),
      expect.objectContaining({ item: 'base:slime_gel', count: 1, at: position }),
    ]);
  });
});
