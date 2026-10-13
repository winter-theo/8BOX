import {
  type ActionStateMessage,
  addItems,
  CONFIG,
  countItem,
  emptyInventory,
  type GameConfig,
  type ItemStack,
  PROTOCOL_VERSION,
  type VitalsMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { damage } from '../../core/damage';
import type { ServerEvents } from '../../core/events';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { interactionModule } from '../interaction';
import { inventoryModule } from '../inventory';
import { movementModule } from '../movement';
import { playersModule } from '../players';
import { survivalModule } from './index';

const GOLD = 'base:gold';
/** Ticks between two actions of a player (more than `actionCooldownMs`). */
const COOLDOWN_TICKS = 6;
/** Direction index of "up" (`DIRECTIONS`). */
const UP = 1;

/** Faster survival (20 ticks per second): 1 hunger point per second, 1 HP per 1/2 s of starvation. */
const config: GameConfig = {
  ...CONFIG,
  survival: {
    ...CONFIG.survival,
    hungerDecayIntervalMs: 1000,
    actionFatigueMs: 600,
    starvationDamageIntervalMs: 500,
    regenIntervalMs: 250,
  },
};

function setup() {
  let clock = 0;
  const test = createTestContext({
    devAuth: true,
    config,
    modules: [playersModule, movementModule, inventoryModule, interactionModule, survivalModule],
    now: () => (clock += 1000),
  });
  const { ctx } = test;
  const X = Math.floor(ctx.world.spawn.x);
  const Y = Math.floor(ctx.world.spawn.y);
  for (let y = Y - 4; y <= Y + 4; y++) {
    for (let x = X - 4; x <= X + 12; x++) {
      ctx.world.setTile(0, x, y, 'object', null);
    }
  }

  /** Joins as `name`; `at` moves the character there (feet position). */
  async function join(name: string, at?: { x: number; y: number }) {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const entity = client.session.player?.entity ?? -1;
    if (at) {
      ctx.entities.set(entity, 'position', { layer: 0, ...at });
    }
    let seq = 0;
    return {
      client,
      entity,
      playerId: client.session.account?.playerId ?? -1,
      health: () => ctx.entities.get(entity, 'health'),
      hunger: () => ctx.entities.get(entity, 'hunger'),
      position: () => ctx.entities.get(entity, 'position'),
      inventory: () => ctx.entities.get(entity, 'inventory') ?? emptyInventory(),
      hold(stacks: ItemStack[]) {
        let next = emptyInventory();
        for (const stack of stacks) {
          next = addItems(next, ctx.content.items, stack).inventory;
        }
        ctx.entities.set(entity, 'inventory', next);
      },
      /** Eats the food in hand; returns the answer of the server. */
      eat(): ActionStateMessage[] {
        const before = client.received.length;
        client.send({ t: 'action', id: 'eat', target: { kind: 'self' } });
        test.tick(COOLDOWN_TICKS);
        return client.received
          .slice(before)
          .filter((message): message is ActionStateMessage => message.t === 'action');
      },
      walk(dir: number, ticks: number) {
        for (let i = 0; i < ticks; i++) {
          client.send({ t: 'input', seq: seq++, dir });
          test.tick(1);
        }
      },
      vitals: () =>
        client.received.filter((message): message is VitalsMessage => message.t === 'vitals'),
    };
  }

  return { ...test, join, X, Y };
}

describe('survival module', () => {
  it('starts with full health and hunger, sent to the player', async () => {
    const { tick, join } = setup();
    const ana = await join('Ana');
    tick(1);
    expect(ana.health()).toBe(20);
    expect(ana.hunger()).toBe(20);
    expect(ana.vitals()).toEqual([{ t: 'vitals', health: 20, hunger: 20 }]);
  });

  it('gets hungry over time, then starves; health comes back when well fed', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana');
    ctx.entities.set(ana.entity, 'hunger', 1);
    tick(25); // Hunger 0 after 1 s (20 ticks).
    expect(ana.hunger()).toBe(0);
    expect(ana.health()).toBe(20);
    tick(10); // 1 HP lost after 1/2 s of starvation (tick 30), not yet the next one (tick 40).
    expect(ana.health()).toBe(19);
    tick(20);
    expect(ana.health()).toBe(17);
    expect(ana.vitals().at(-1)).toEqual({ t: 'vitals', health: 17, hunger: 0 });

    ctx.entities.set(ana.entity, 'hunger', 20);
    tick(16); // +1 HP every 250 ms (5 ticks).
    expect(ana.health()).toBe(20);
  });

  it('eats the food in hand, unless full', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana');
    const performed: ServerEvents['action.performed'][] = [];
    ctx.events.on('action.performed', (event) => performed.push(event));
    ana.hold([{ item: 'base:berries', count: 3 }]);
    ctx.entities.set(ana.entity, 'hunger', 10);

    expect(ana.eat()).toEqual([{ t: 'action', id: 'eat', outcome: 'done' }]);
    expect(ana.hunger()).toBe(12);
    expect(countItem(ana.inventory(), 'base:berries')).toBe(2);
    expect(performed).toEqual([{ entity: ana.entity, action: 'eat' }]);

    ana.hold([{ item: 'base:apple', count: 1 }]);
    ana.eat();
    expect(ana.hunger()).toBe(16);
    expect(countItem(ana.inventory(), 'base:apple')).toBe(0);

    ana.hold([{ item: 'base:apple', count: 1 }]);
    ctx.entities.set(ana.entity, 'hunger', 20);
    expect(ana.eat()[0]?.reason).toBe('full');
    expect(countItem(ana.inventory(), 'base:apple')).toBe(1);

    ana.hold([{ item: 'base:oak_log', count: 1 }]);
    ctx.entities.set(ana.entity, 'hunger', 10);
    expect(ana.eat()[0]?.reason).toBe('unavailable');
  });

  it('gets hungry sooner after actions that take effort', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana');
    const bob = await join('Bob');
    tick(1);
    // Two hits (2 × 600 ms of fatigue) bring the next hunger loss forward.
    ctx.events.emit('action.performed', { entity: ana.entity, action: 'cut' });
    ctx.events.emit('action.performed', { entity: ana.entity, action: 'cut' });
    ctx.events.emit('action.performed', { entity: bob.entity, action: 'examine' });
    ctx.events.emit('action.performed', { entity: bob.entity, action: 'examine' });
    tick(1);
    expect(ana.hunger()).toBe(19);
    expect(bob.hunger()).toBe(20);
  });

  it('on death, drops 10 % of the gold where the player died, for anyone to pick up', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana', { x: X + 6.5, y: Y + 0.5 });
    const bob = await join('Bob', { x: X + 1.5, y: Y + 0.5 });
    const died: ServerEvents['entity.died'][] = [];
    ctx.events.on('entity.died', (event) => died.push(event));
    ana.hold([{ item: GOLD, count: 255 }]);
    ctx.entities.set(ana.entity, 'health', 1);
    ctx.entities.set(ana.entity, 'hunger', 0);

    tick(15);
    expect(ana.health()).toBe(0);
    expect(ctx.entities.get(ana.entity, 'dead')).toBe('starvation');
    expect(ana.vitals().at(-1)).toEqual({ t: 'vitals', health: 0, hunger: 0, dead: 'starvation' });
    expect(died).toEqual([
      {
        entity: ana.entity,
        type: 'player',
        position: { layer: 0, x: X + 6.5, y: Y + 0.5 },
        source: { cause: 'starvation' },
      },
    ]);
    expect(ana.inventory().purse).toBe(230);
    const piles = ctx.entities.query('groundItem');
    expect(piles.map((id) => ctx.entities.get(id, 'groundItem')?.count)).toEqual([25]);

    // Dead: no move, no action, nothing picked up (not even the gold at their feet).
    ana.walk(UP, 10);
    expect(ana.position()).toEqual({ layer: 0, x: X + 6.5, y: Y + 0.5 });
    ana.hold([
      { item: 'base:apple', count: 1 },
      { item: GOLD, count: 230 },
    ]);
    expect(ana.eat()[0]?.reason).toBe('unavailable');
    tick(100);
    expect(ana.inventory().purse).toBe(230);
    expect(ana.health()).toBe(0);

    ctx.entities.set(bob.entity, 'position', { layer: 0, x: X + 6.5, y: Y + 0.5 });
    tick(1);
    expect(bob.inventory().purse).toBe(25);
  });

  it('respawns next to the bed while it exists, otherwise at the spawn, invulnerable for 5 s', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana', { x: X + 6.5, y: Y + 0.5 });
    const bed = { layer: 0, x: X + 9, y: Y };
    ctx.world.setTile(0, bed.x, bed.y, 'object', 'base:bed');
    ctx.entities.set(ana.entity, 'spawnPoint', bed);

    // Asking to respawn while alive does nothing.
    ana.client.send({ t: 'respawn' });
    expect(ana.position()).toEqual({ layer: 0, x: X + 6.5, y: Y + 0.5 });

    ctx.entities.set(ana.entity, 'hunger', 3);
    expect(damage(ctx, ana.entity, 25, { cause: 'starvation' })).toBe(20);
    expect(damage(ctx, ana.entity, 5, { cause: 'starvation' })).toBe(0);
    ana.client.send({ t: 'respawn' });
    tick(1);
    expect(ana.position()).toEqual({ layer: 0, x: bed.x + 0.5, y: bed.y + 1.5 });
    expect(ana.health()).toBe(20);
    expect(ana.hunger()).toBe(20);
    expect(ctx.entities.has(ana.entity, 'dead')).toBe(false);
    expect(ana.vitals().at(-1)).toEqual({ t: 'vitals', health: 20, hunger: 20 });

    // 5 s of invulnerability (100 ticks).
    tick(90);
    expect(damage(ctx, ana.entity, 3, { cause: 'starvation' })).toBe(0);
    tick(10);
    expect(damage(ctx, ana.entity, 3, { cause: 'starvation' })).toBe(3);

    // The bed is gone: back to the spawn, and the bed is forgotten.
    ctx.world.setTile(0, bed.x, bed.y, 'object', null);
    damage(ctx, ana.entity, 20, { cause: 'starvation' });
    ana.client.send({ t: 'respawn' });
    expect(ana.position()).toEqual({ layer: 0, x: ctx.world.spawn.x, y: ctx.world.spawn.y });
    expect(ctx.entities.has(ana.entity, 'spawnPoint')).toBe(false);
  });

  it('saves health and hunger; a player who left while dead respawns when they come back', async () => {
    const { ctx, tick, join, X, Y } = setup();
    const ana = await join('Ana', { x: X + 6.5, y: Y + 0.5 });
    ctx.entities.set(ana.entity, 'health', 7);
    ctx.entities.set(ana.entity, 'hunger', 9);
    ctx.net.handleClose(ana.client.session);
    expect(ctx.persistence.character(ana.playerId)).toMatchObject({ health: 7, hunger: 9 });

    const again = await join('Ana');
    expect(again.health()).toBe(7);
    expect(again.hunger()).toBe(9);
    expect(again.position()).toMatchObject({ x: X + 6.5, y: Y + 0.5 });

    damage(ctx, again.entity, 7, { cause: 'starvation' });
    tick(1);
    ctx.net.handleClose(again.client.session);
    expect(ctx.persistence.character(ana.playerId)).toMatchObject({ health: 0 });

    const back = await join('Ana');
    expect(back.health()).toBe(20);
    expect(back.hunger()).toBe(20);
    expect(ctx.entities.has(back.entity, 'dead')).toBe(false);
    expect(back.position()).toEqual({ layer: 0, x: ctx.world.spawn.x, y: ctx.world.spawn.y });
  });
});
