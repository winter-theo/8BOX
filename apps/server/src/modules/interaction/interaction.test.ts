import {
  type ActionDef,
  type ActionStateMessage,
  type ActionTarget,
  addItems,
  baseActions,
  type ExaminedMessage,
  emptyInventory,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import type { EntityId } from '../../core/entities';
import type { ServerContext } from '../../core/module';
import { connectFakeClient, createTestContext, type FakeClient, settle } from '../../core/testing';
import { inventoryModule } from '../inventory';
import { movementModule } from '../movement';
import { playersModule } from '../players';
import { interactionModule } from './index';

const APPLE = 'base:apple';
const LOG = 'base:oak_log';

/** A test action that takes time: half a second, on oneself. */
const restAction: ActionDef = {
  id: 'rest',
  targets: ['self'],
  priority: 5,
  durationMs: 500,
  labelKey: 'rest',
  appliesTo: () => true,
  canPerform: () => ({ ok: true }),
};

function setup() {
  // Each message comes one second after the previous one: rate limits never get in the way.
  let clock = 0;
  const test = createTestContext({
    devAuth: true,
    modules: [playersModule, movementModule, inventoryModule, interactionModule],
    actions: [...baseActions, restAction],
    now: () => (clock += 1000),
  });
  const { ctx } = test;
  const rested: EntityId[] = [];
  ctx.actions.register('rest', ({ entity }) => {
    rested.push(entity);
    return undefined;
  });

  /** The spawn tile: the clearing around it has nothing solid. */
  const X = Math.floor(ctx.world.spawn.x);
  const Y = Math.floor(ctx.world.spawn.y);

  async function join(name: string, x = X + 0.5, y = Y + 0.5) {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const entity = client.session.player?.entity ?? -1;
    moveTo(ctx, entity, x, y);
    return {
      client,
      entity,
      inventory: () => ctx.entities.get(entity, 'inventory'),
      /** Sends an action and returns what the server answered at once. */
      act(id: string, target: ActionTarget): ServerMessage[] {
        const before = client.received.length;
        client.send({ t: 'action', id, target });
        return client.received.slice(before);
      },
    };
  }

  return { ...test, rested, join, X, Y };
}

/** Puts a player's feet somewhere else (a test shortcut for walking there). */
function moveTo(ctx: ServerContext, entity: EntityId, x: number, y: number) {
  ctx.entities.set(entity, 'position', { layer: 0, x, y });
}

/** Puts a pile of items on the ground, far from expiring. */
function pile(ctx: ServerContext, item: string, count: number, x: number, y: number): EntityId {
  return ctx.entities.create('groundItem', {
    position: { layer: 0, x, y },
    groundItem: { item, count, dropperWaitUntilTick: 0, expiresAtTick: 1_000_000 },
  });
}

function states(messages: readonly ServerMessage[]): ActionStateMessage[] {
  return messages.filter((message): message is ActionStateMessage => message.t === 'action');
}

function examined(client: FakeClient): ExaminedMessage[] {
  return client.received.filter((message): message is ExaminedMessage => message.t === 'examined');
}

describe('interaction module', () => {
  it('examines a tile in reach: its name, then done', async () => {
    const { ctx, join, X, Y } = setup();
    const ana = await join('Ana');
    const thing =
      ctx.world.getTile(0, X + 1, Y, 'object') ?? ctx.world.getTile(0, X + 1, Y, 'ground');

    expect(ana.act('examine', { kind: 'tile', x: X + 1, y: Y })).toEqual([
      { t: 'examined', thing: thing?.id },
      { t: 'action', id: 'examine', outcome: 'done' },
    ]);
  });

  it('refuses an action out of reach, even when the client sends it', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana');
    const apples = pile(ctx, APPLE, 3, X + 3.5, Y + 0.5);

    expect(ana.act('examine', { kind: 'tile', x: X + 3, y: Y })).toEqual([
      { t: 'action', id: 'examine', outcome: 'refused', reason: 'outOfReach' },
    ]);
    tick(10);
    expect(states(ana.act('pickUp', { kind: 'entity', id: apples }))).toEqual([
      { t: 'action', id: 'pickUp', outcome: 'refused', reason: 'outOfReach' },
    ]);
    expect(ctx.entities.get(apples, 'groundItem')?.count).toBe(3);
    expect(ana.inventory()).toEqual(emptyInventory());
    expect(examined(ana.client)).toEqual([]);

    // One step closer, the same requests go through.
    moveTo(ctx, ana.entity, X + 1.6, Y + 0.5);
    tick(10);
    expect(states(ana.act('pickUp', { kind: 'entity', id: apples }))).toEqual([
      { t: 'action', id: 'pickUp', outcome: 'done' },
    ]);
  });

  it('picks up a pile in reach (what fits), and refuses with a full inventory', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana');
    const apples = pile(ctx, APPLE, 3, X + 1.5, Y + 0.5);

    ana.act('pickUp', { kind: 'entity', id: apples });
    expect(ctx.entities.exists(apples)).toBe(false);
    expect(ana.inventory()?.slots[0]).toEqual({ item: APPLE, count: 3 });
    tick();
    expect(ana.client.received.filter((message) => message.t === 'inventory').at(-1)).toMatchObject(
      {
        slots: [{ item: APPLE, count: 3 }, null, null, null, null, null, null, null, null, null],
      },
    );

    // Full of logs, but for room for 2 apples.
    const items = ctx.content.items;
    let full = addItems(emptyInventory(), items, { item: LOG, count: 99 * 10 }).inventory;
    full = { ...full, slots: [{ item: APPLE, count: 97 }, ...full.slots.slice(1)] };
    ctx.entities.set(ana.entity, 'inventory', full);
    const more = pile(ctx, APPLE, 5, X + 1.5, Y + 0.5);
    tick(10);
    expect(states(ana.act('pickUp', { kind: 'entity', id: more }))).toEqual([
      { t: 'action', id: 'pickUp', outcome: 'done' },
    ]);
    expect(ctx.entities.get(more, 'groundItem')?.count).toBe(3);
    tick(10);
    expect(ana.act('pickUp', { kind: 'entity', id: more })).toEqual([
      { t: 'action', id: 'pickUp', outcome: 'refused', reason: 'inventoryFull' },
    ]);
    expect(ctx.entities.get(more, 'groundItem')?.count).toBe(3);
  });

  it('examines a pile (with its size) and a player', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob', X + 1.5, Y + 1.5);
    const apples = pile(ctx, APPLE, 4, X + 0.5, Y + 1.5);

    ana.act('examine', { kind: 'entity', id: apples });
    tick(10);
    ana.act('examine', { kind: 'entity', id: bob.entity });
    expect(examined(ana.client)).toEqual([
      { t: 'examined', thing: APPLE, count: 4 },
      { t: 'examined', player: 'Bob' },
    ]);
  });

  it('refuses unknown actions, wrong targets and targets that are gone', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana');
    const tile: ActionTarget = { kind: 'tile', x: X + 1, y: Y };
    const refusals = [
      ana.act('fly', tile),
      ana.act('pickUp', tile),
      ana.act('examine', { kind: 'entity', id: 999 }),
      ana.act('examine', { kind: 'entity', id: ana.entity }),
      ana.act('examine', { kind: 'tile', x: 1000, y: 3 }),
    ];
    expect(refusals.map((messages) => states(messages)[0]?.reason)).toEqual([
      'unavailable',
      'unavailable',
      'gone',
      'gone',
      'gone',
    ]);

    // An entity on another layer is not there either.
    const below = ctx.entities.create('groundItem', {
      position: { layer: 1, x: 21.5, y: 20.5 },
      groundItem: { item: APPLE, count: 1, dropperWaitUntilTick: 0, expiresAtTick: 1_000_000 },
    });
    tick(10);
    expect(states(ana.act('pickUp', { kind: 'entity', id: below }))[0]?.reason).toBe('gone');
  });

  it('keeps a delay between two actions', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana');
    const tile: ActionTarget = { kind: 'tile', x: X + 1, y: Y };

    expect(states(ana.act('examine', tile))[0]?.outcome).toBe('done');
    expect(states(ana.act('examine', tile))[0]).toMatchObject({ reason: 'tooSoon' });
    tick(ctx.scheduler.ticksFor(ctx.config.interaction.actionCooldownMs) - 1);
    expect(states(ana.act('examine', tile))[0]).toMatchObject({ reason: 'tooSoon' });
    tick();
    expect(states(ana.act('examine', tile))[0]?.outcome).toBe('done');
  });

  it('ends an action that takes time after its duration', async () => {
    const { ctx, tick, rested, join, X, Y } = setup();
    const ana = await join('Ana');

    expect(ana.act('rest', { kind: 'self' })).toEqual([
      { t: 'action', id: 'rest', outcome: 'started', durationMs: 500 },
    ]);
    tick(2);
    expect(states(ana.act('examine', { kind: 'tile', x: X + 1, y: Y }))[0]).toMatchObject({
      reason: 'busy',
    });
    const ticks = ctx.scheduler.ticksFor(restAction.durationMs ?? 0);
    tick(ticks - 3);
    expect(rested).toEqual([]);
    tick();
    expect(rested).toEqual([ana.entity]);
    expect(states(ana.client.received).at(-1)).toEqual({
      t: 'action',
      id: 'rest',
      outcome: 'done',
    });
  });

  it('cancels an action that takes time when the player moves', async () => {
    const { tick, rested, join } = setup();
    const ana = await join('Ana');

    ana.act('rest', { kind: 'self' });
    tick(2);
    ana.client.send({ t: 'input', seq: 0, dir: 3 });
    tick();
    expect(states(ana.client.received).at(-1)).toEqual({
      t: 'action',
      id: 'rest',
      outcome: 'cancelled',
    });
    tick(20);
    expect(rested).toEqual([]);
  });
});
