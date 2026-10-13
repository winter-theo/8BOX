import {
  type ActionStateMessage,
  addItems,
  CONFIG,
  emptyInventory,
  type Facing,
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
import { survivalModule } from '../survival';
import { combatModule } from './index';

const SWORD = 'base:wooden_sword';
/** Ticks after which any weapon may hit again, and the target can be hurt again (500 ms). */
const RECOVERY_TICKS = 10;
/** A small safe zone, for the small test world. */
const config: GameConfig = { ...CONFIG, world: { ...CONFIG.world, safeZoneRadiusTiles: 4 } };

function setup() {
  const test = createTestContext({
    devAuth: true,
    config,
    modules: [
      playersModule,
      movementModule,
      chunksModule,
      inventoryModule,
      interactionModule,
      survivalModule,
      combatModule,
    ],
  });
  const { ctx } = test;
  const X = Math.floor(ctx.world.spawn.x);
  const Y = Math.floor(ctx.world.spawn.y);
  /** Far enough from the spawn to be out of the safe zone. */
  const OUT = X + 8;
  for (const x0 of [X, OUT]) {
    for (let y = Y - 3; y <= Y + 3; y++) {
      for (let x = x0 - 3; x <= x0 + 4; x++) {
        ctx.world.setTile(0, x, y, 'ground', 'base:grass');
        ctx.world.setTile(0, x, y, 'floor', null);
        ctx.world.setTile(0, x, y, 'object', null);
      }
    }
  }
  const killed: ServerEvents['player.killed'][] = [];
  ctx.events.on('player.killed', (event) => killed.push(event));

  /** Joins as `name`, standing at (x, y) (feet) and looking toward `facing`. */
  async function join(name: string, x: number, y: number, facing: Facing) {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    client.send({ t: 'viewport', w: 640, h: 360, zoom: 4 });
    const entity = client.session.player?.entity ?? -1;
    ctx.entities.set(entity, 'position', { layer: 0, x, y });
    ctx.entities.set(entity, 'facing', facing);
    return {
      client,
      entity,
      health: () => ctx.entities.get(entity, 'health'),
      x: () => ctx.entities.get(entity, 'position')?.x,
      moveTo: (to: number) => ctx.entities.set(entity, 'position', { layer: 0, x: to, y }),
      inventory: () => ctx.entities.get(entity, 'inventory') ?? emptyInventory(),
      hold(stack: ItemStack) {
        ctx.entities.set(
          entity,
          'inventory',
          addItems(emptyInventory(), ctx.content.items, stack).inventory,
        );
      },
      /** Hits in front; returns the answer of the server. */
      attack(): ActionStateMessage | undefined {
        client.send({ t: 'action', id: 'attack', target: { kind: 'self' } });
        return client.received.findLast(
          (message): message is ActionStateMessage => message.t === 'action',
        );
      },
      got: (type: ServerMessage['t']) => client.received.filter((message) => message.t === type),
    };
  }

  return { ...test, join, X, Y, OUT, killed };
}

describe('combat module', () => {
  it('lets two players fight out of the safe zone: damage, knockback, blink and swing shown', async () => {
    const { tick, join, ctx, OUT, Y } = setup();
    const ana = await join('Ana', OUT + 0.5, Y + 0.5, 'right');
    const bob = await join('Bob', OUT + 1.2, Y + 0.5, 'left');
    tick(1);
    expect(ana.attack()).toMatchObject({ id: 'attack', outcome: 'done' });
    expect(bob.health()).toBe(19);
    expect(bob.x()).toBeCloseTo(OUT + 1.7);
    expect(bob.got('damaged')).toEqual([{ t: 'damaged', entity: bob.entity, amount: 1 }]);
    expect(ana.got('damaged')).toEqual([{ t: 'damaged', entity: bob.entity, amount: 1 }]);
    expect(bob.got('swing')).toEqual([{ t: 'swing', entity: ana.entity, facing: 'right' }]);
    expect(ana.got('swing')).toEqual([]); // Drawn at once by the attacker's client.
    // Cannot be hurt for a moment (it blinks).
    expect(ctx.entities.get(bob.entity, 'invulnerableUntilTick')).toBe(
      ctx.scheduler.currentTick + RECOVERY_TICKS,
    );
  });

  it('refuses PvP in the safe zone: the swing happens, nobody is hurt', async () => {
    const { tick, join, X, Y } = setup();
    const ana = await join('Ana', X + 0.5, Y + 0.5, 'right');
    const bob = await join('Bob', X + 1.2, Y + 0.5, 'left');
    tick(1);
    expect(ana.attack()).toMatchObject({ outcome: 'done' });
    tick(RECOVERY_TICKS);
    expect(bob.attack()).toMatchObject({ outcome: 'done' });
    expect(ana.health()).toBe(20);
    expect(bob.health()).toBe(20);
    expect(bob.x()).toBeCloseTo(X + 1.2);
    expect(ana.got('swing')).toHaveLength(1);
  });

  it('hurts more with the wooden sword than bare-handed, and wears it when it lands', async () => {
    const { tick, join, OUT, Y } = setup();
    const ana = await join('Ana', OUT + 0.5, Y + 0.5, 'right');
    const bob = await join('Bob', OUT + 1.2, Y + 0.5, 'left');
    ana.hold({ item: SWORD, count: 1 });
    tick(1);
    ana.attack();
    expect(bob.health()).toBe(17);
    expect(ana.inventory().slots[0]?.durability).toBe(59);
    expect(bob.got('swing')).toEqual([
      { t: 'swing', entity: ana.entity, facing: 'right', item: SWORD },
    ]);
    // A swing in the air does not wear it.
    tick(RECOVERY_TICKS);
    bob.moveTo(OUT + 3);
    ana.attack();
    expect(ana.inventory().slots[0]?.durability).toBe(59);
  });

  it('never hits faster than the cooldown of the weapon (checked by the server)', async () => {
    const { tick, join, OUT, Y } = setup();
    const ana = await join('Ana', OUT + 0.5, Y + 0.5, 'right');
    const bob = await join('Bob', OUT + 1.2, Y + 0.5, 'left');
    ana.hold({ item: SWORD, count: 1 });
    tick(1);
    ana.attack();
    tick(6); // 300 ms: more than the delay between two actions, less than the sword's 450 ms.
    bob.moveTo(OUT + 1.2);
    expect(ana.attack()).toMatchObject({ outcome: 'refused', reason: 'tooSoon' });
    tick(5); // The refused attempt counts as an action: wait the delay between two actions.
    expect(ana.attack()).toMatchObject({ outcome: 'done' });
    expect(bob.health()).toBe(14);
  });

  it('does not push a target through a wall', async () => {
    const { tick, join, ctx, OUT, Y } = setup();
    ctx.world.setTile(0, OUT + 2, Y, 'object', 'base:wooden_wall');
    const ana = await join('Ana', OUT + 0.8, Y + 0.5, 'right');
    const bob = await join('Bob', OUT + 1.5, Y + 0.5, 'left');
    tick(1);
    ana.attack();
    expect(bob.health()).toBe(19);
    expect(bob.x()).toBeCloseTo(OUT + 2 - 0.3);
  });

  it('tells who killed whom, and who hit first', async () => {
    const { tick, join, ctx, OUT, Y, killed } = setup();
    const ana = await join('Ana', OUT + 0.5, Y + 0.5, 'right');
    const bob = await join('Bob', OUT + 1.2, Y + 0.5, 'left');
    tick(1);
    bob.attack(); // Bob starts the fight.
    expect(ana.health()).toBe(19);
    ctx.entities.set(bob.entity, 'health', 1);
    tick(RECOVERY_TICKS);
    bob.moveTo(OUT + 1.2);
    ana.attack();
    expect(bob.health()).toBe(0);
    expect(ctx.entities.get(bob.entity, 'dead')).toBe('hit');
    expect(killed).toEqual([{ killer: ana.entity, victim: bob.entity, firstHit: bob.entity }]);
  });
});
