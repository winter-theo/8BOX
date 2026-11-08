import {
  type ChatNoticeMessage,
  CONFIG,
  clockTime,
  countItem,
  emptyInventory,
  LAYER,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { Accounts } from '../../accounts/Accounts';
import { MemoryAccountStore } from '../../accounts/account';
import { MemoryAdminStore } from '../../admin/store';
import { executeCommand } from '../../core/commands';
import { damage } from '../../core/damage';
import { connectFakeClient, createTestContext, type FakeClient, settle } from '../../core/testing';
import { chatModule } from '../chat';
import { chunksModule } from '../chunks';
import { inventoryModule } from '../inventory';
import { movementModule } from '../movement';
import { persistenceModule } from '../persistence';
import { playersModule } from '../players';
import { snapshotsModule } from '../snapshots';
import { spawningModule } from '../spawning';
import { survivalModule } from '../survival';
import { timeModule } from '../time';
import { adminModule } from './index';

const LOG = 'base:oak_log';

function setup(devAuth = true) {
  let clock = 0;
  const store = new MemoryAccountStore();
  const test = createTestContext({
    devAuth,
    accounts: new Accounts(store, undefined, []),
    adminStore: new MemoryAdminStore(store),
    modules: [
      playersModule,
      timeModule,
      movementModule,
      chunksModule,
      snapshotsModule,
      persistenceModule,
      chatModule,
      inventoryModule,
      survivalModule,
      spawningModule,
      adminModule,
    ],
    now: () => (clock += 1000),
  });
  const { ctx } = test;

  async function join(name: string, role: 'player' | 'admin' = 'player') {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const account = client.session.account;
    if (!account) {
      throw new Error(`${name} could not join`);
    }
    client.session.account = await store.update(account.playerId, { role });
    const entity = client.session.player?.entity ?? -1;
    return {
      client,
      entity,
      /** Runs a command line typed by this player. */
      type: (line: string) => executeCommand(ctx, client.session, line),
      position: () => ctx.entities.get(entity, 'position'),
    };
  }

  return { ...test, join };
}

/** The chat notices a client got, without their type, and forgets them. */
function notices(client: FakeClient): Omit<ChatNoticeMessage, 't'>[] {
  const found = client.received.flatMap((message: ServerMessage) => {
    if (message.t !== 'chatNotice') {
      return [];
    }
    const { t: _, ...notice } = message;
    return [notice];
  });
  client.received.length = 0;
  return found;
}

describe('/tp and /tphere', () => {
  it('teleports the admin to a tile, or to a player', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    ctx.entities.set(bob.entity, 'position', { layer: LAYER.surface, x: 30.2, y: 31.7 });
    notices(ana.client);

    ana.type('/tp 10 12');
    expect(ana.position()).toEqual({ layer: LAYER.surface, x: 10.5, y: 12.5 });
    ana.type('/tp bo');
    expect(ana.position()).toEqual({ layer: LAYER.surface, x: 30.2, y: 31.7 });

    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'tp', values: { x: 10, y: 12 } },
      { notice: 'done', command: 'tp', values: { x: 30, y: 31 } },
    ]);
  });

  it('refuses a point outside the world, in a wall, or oneself', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const start = ana.position();
    ctx.world.setTile(LAYER.surface, 20, 20, 'object', 'base:wooden_wall');
    notices(ana.client);

    ana.type('/tp 5000 10');
    ana.type('/tp 10 10 -1'); // The mine does not exist yet.
    ana.type('/tp 20 20');
    ana.type('/tp ana');
    expect(ana.position()).toEqual(start);

    // In admin mode, walls do not count.
    ctx.entities.set(ana.entity, 'adminMode', true);
    ana.type('/tp 20 20');
    expect(ana.position()).toEqual({ layer: LAYER.surface, x: 20.5, y: 20.5 });

    expect(notices(ana.client)).toEqual([
      { notice: 'refused', command: 'tp', reason: 'outside' },
      { notice: 'refused', command: 'tp', reason: 'outside' },
      { notice: 'refused', command: 'tp', reason: 'blocked' },
      { notice: 'self' },
      { notice: 'done', command: 'tp', values: { x: 20, y: 20 } },
    ]);
  });

  it('brings a player to the admin, unless the admin stands in a wall', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    ctx.entities.set(ana.entity, 'position', { layer: LAYER.surface, x: 12.5, y: 14.5 });
    notices(ana.client);

    ana.type('/tphere Bob');
    expect(bob.position()).toEqual({ layer: LAYER.surface, x: 12.5, y: 14.5 });

    ctx.world.setTile(LAYER.surface, 12, 14, 'object', 'base:wooden_wall');
    ctx.entities.set(bob.entity, 'position', { layer: LAYER.surface, x: 3.5, y: 3.5 });
    ana.type('/tphere Bob');
    expect(bob.position()).toEqual({ layer: LAYER.surface, x: 3.5, y: 3.5 });

    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'tphere', name: 'Bob' },
      { notice: 'refused', command: 'tphere', reason: 'blocked', name: 'Bob' },
    ]);
  });
});

describe('/give', () => {
  it('gives items to a player, one by default', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    const inventory = () => ctx.entities.get(bob.entity, 'inventory');
    notices(ana.client);

    ana.type('/give Bob oak_log 10');
    ana.type('/give bob base:oak_log');
    ana.type('/give Bob gold 250');

    expect(countItem(inventory() ?? emptyInventory(), LOG)).toBe(11);
    expect(inventory()?.purse).toBe(250);
    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'give', name: 'Bob', thing: LOG, values: { count: 10 } },
      { notice: 'done', command: 'give', name: 'Bob', thing: LOG, values: { count: 1 } },
      { notice: 'done', command: 'give', name: 'Bob', thing: 'base:gold', values: { count: 250 } },
    ]);
  });

  it('gives what fits, and tells when nothing does', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    const slots = CONFIG.inventory.mainSlots;
    const stack = CONFIG.inventory.defaultStackSize;
    notices(ana.client);

    ana.type(`/give Bob oak_log ${slots * stack + 5}`);
    ana.type('/give Bob stick');

    const inventory = ctx.entities.get(bob.entity, 'inventory');
    expect(inventory && countItem(inventory, LOG)).toBe(slots * stack);
    expect(notices(ana.client)).toEqual([
      {
        notice: 'done',
        command: 'give',
        name: 'Bob',
        thing: LOG,
        values: { count: slots * stack },
      },
      { notice: 'refused', command: 'give', reason: 'inventoryFull', name: 'Bob' },
    ]);
  });

  it('fails cleanly on an unknown player or item, or a wrong count', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    await join('Bob');
    notices(ana.client);

    ana.type('/give Zoe oak_log');
    ana.type('/give Bob diamond');
    ana.type('/give Bob oak_log 0');
    ana.type('/give Bob');

    expect(ctx.entities.query('inventory').map((e) => ctx.entities.get(e, 'inventory'))).toEqual([
      expect.objectContaining({ purse: 0 }),
      expect.objectContaining({ purse: 0 }),
    ]);
    expect(notices(ana.client)).toEqual([
      { notice: 'unknownPlayer', name: 'Zoe' },
      { notice: 'unknownItem', values: { arg: 'diamond' } },
      { notice: 'usage', command: 'give' },
      { notice: 'usage', command: 'give' },
    ]);
  });
});

describe('admin commands', () => {
  it('are unknown to the other players, even typed in the chat', async () => {
    const { join } = setup();
    const ana = await join('Ana');
    const start = ana.position();

    ana.client.send({ t: 'chat', text: '/tp 10 10' });
    ana.client.send({ t: 'chat', text: '/who' });
    ana.client.send({ t: 'chat', text: '/aide' });

    expect(ana.position()).toEqual(start);
    expect(notices(ana.client)).toEqual([
      { notice: 'unknownCommand' },
      { notice: 'unknownCommand' },
      { notice: 'help', list: ['help', 'msg', 'reply', 'report'] },
    ]);
  });

  it('/heal gives full health and hunger back', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    ctx.entities.set(bob.entity, 'health', 3);
    ctx.entities.set(bob.entity, 'hunger', 2);
    ctx.entities.set(ana.entity, 'health', 7);
    notices(ana.client);

    ana.type('/heal Bob');
    ana.type('/heal');
    ctx.entities.set(bob.entity, 'dead', 'starvation');
    ana.type('/heal Bob');

    expect(ctx.entities.get(bob.entity, 'health')).toBe(CONFIG.survival.maxHealth);
    expect(ctx.entities.get(bob.entity, 'hunger')).toBe(CONFIG.survival.maxHunger);
    expect(ctx.entities.get(ana.entity, 'health')).toBe(CONFIG.survival.maxHealth);
    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'heal', name: 'Bob' },
      { notice: 'done', command: 'heal', name: 'Ana' },
      { notice: 'refused', command: 'heal', reason: 'dead', name: 'Bob' },
    ]);
  });

  it('/time sets the time of day and tells every player', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    const start = ctx.clock.timeMs;
    notices(ana.client);
    bob.client.received.length = 0;

    ana.type('/time nuit');

    expect(clockTime(ctx.clock.timeMs)).toEqual({ hours: CONFIG.admin.timeNightHour, minutes: 0 });
    expect(ctx.clock.timeMs).toBeGreaterThan(start);
    expect(bob.client.received).toContainEqual(
      expect.objectContaining({ t: 'time', worldTimeMs: Math.round(ctx.clock.timeMs) }),
    );
    ana.type('/time 7:45');
    expect(clockTime(ctx.clock.timeMs)).toEqual({ hours: 7, minutes: 45 });
    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'time', values: { clock: '22:00' } },
      { notice: 'done', command: 'time', values: { clock: '7:45' } },
    ]);
  });

  it('/who lists the players, /annonce tells them all', async () => {
    const { join } = setup();
    const zed = await join('Zed', 'admin');
    const bob = await join('bob');
    notices(bob.client);
    notices(zed.client);

    zed.type('/who');
    zed.type('/annonce Redémarrage dans 5 minutes');

    const announcement = {
      notice: 'announcement',
      name: 'Zed',
      values: { text: 'Redémarrage dans 5 minutes' },
    };
    expect(notices(zed.client)).toEqual([{ notice: 'who', list: ['bob', 'Zed'] }, announcement]);
    expect(notices(bob.client)).toEqual([announcement]);
  });

  it('/save saves everything at once', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    notices(ana.client);

    ana.type('/save');
    await settle();

    expect(ctx.persistence.character(ana.client.session.account?.playerId ?? -1)).toBeDefined();
    expect(notices(ana.client)).toEqual([{ notice: 'done', command: 'save' }]);
  });

  it('/spawnmob makes monsters appear around the admin, in dev mode only', async () => {
    const dev = setup();
    const ana = await dev.join('Ana', 'admin');
    notices(ana.client);

    ana.type('/spawnmob slime 3');
    ana.type('/spawnmob dragon');

    const monsters = dev.ctx.entities.query('monster');
    expect(monsters).toHaveLength(3);
    expect(dev.ctx.entities.get(monsters[0] ?? -1, 'monster')).toEqual({ creature: 'base:slime' });
    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'spawnmob', thing: 'base:slime', values: { count: 3 } },
      { notice: 'unknownCreature', values: { arg: 'dragon' } },
    ]);

    const prod = setup(false);
    expect(prod.ctx.commands.find('spawnmob', 'admin')).toBeUndefined();
  });
});

describe('sanctions', () => {
  it('/kick sends a player out, with the reason in the audit log', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    notices(ana.client);

    ana.type('/kick bo spam au spawn');
    await settle();
    ana.type('/kick Ana');
    await settle();

    expect(bob.client.received).toContainEqual({ t: 'rejected', reason: 'kicked' });
    expect(bob.client.closed).toBeDefined();
    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'kick', name: 'Bob' },
      { notice: 'self' },
    ]);
    const audit = await ctx.admin.audit();
    expect(audit.map(({ action, targetName, reason }) => ({ action, targetName, reason }))).toEqual(
      [{ action: 'kick', targetName: 'Bob', reason: 'spam au spawn' }],
    );
  });

  it('/ban and /unban work on players who are not in the game', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    notices(ana.client);

    ana.type('/ban bob triche');
    await settle();
    expect(bob.client.received).toContainEqual({ t: 'status', state: 'banned', reason: 'triche' });
    expect(bob.client.closed).toBeDefined();
    ana.type('/ban Bob');
    await settle();
    ana.type('/unban BOB');
    await settle();
    ana.type('/unban Bob');
    await settle();
    ana.type('/ban Zoe');
    await settle();

    expect(notices(ana.client)).toEqual([
      { notice: 'done', command: 'ban', name: 'Bob' },
      { notice: 'refused', command: 'ban', reason: 'wrongStatus', name: 'Bob' },
      { notice: 'done', command: 'unban', name: 'Bob' },
      { notice: 'refused', command: 'unban', reason: 'wrongStatus', name: 'Bob' },
      { notice: 'unknownPlayer', name: 'Zoe' },
    ]);
    const audit = await ctx.admin.audit();
    expect(audit.map(({ action, reason }) => ({ action, reason }))).toEqual([
      { action: 'unban', reason: null },
      { action: 'ban', reason: 'triche' },
    ]);
  });

  it('/mute takes the chat away for a while, /unmute gives it back', async () => {
    const { join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    const cleo = await join('Cleo', 'admin');
    notices(ana.client);

    ana.type('/mute Bob 0');
    ana.type('/mute Bob 15');
    await settle();
    ana.type('/mute Cleo 5');
    await settle();
    bob.client.send({ t: 'chat', text: 'coucou' });
    expect(notices(bob.client)).toEqual([{ notice: 'muted', until: expect.any(Number) as number }]);
    ana.type('/unmute bob');
    await settle();

    expect(notices(ana.client)).toEqual([
      { notice: 'usage', command: 'mute' },
      { notice: 'done', command: 'mute', name: 'Bob', values: { minutes: 15 } },
      { notice: 'refused', command: 'mute', reason: 'targetIsAdmin', name: 'Cleo' },
      { notice: 'done', command: 'unmute', name: 'Bob' },
    ]);
    expect(notices(cleo.client)).toEqual([]);
  });
});

describe('admin mode', () => {
  it('turns on and off with /admin, and the client is told', async () => {
    const { ctx, join } = setup();
    const ana = await join('Ana', 'admin');
    notices(ana.client);

    ana.type('/admin');
    expect(ctx.entities.has(ana.entity, 'adminMode')).toBe(true);
    expect(ana.client.received).toContainEqual({ t: 'adminMode', on: true });
    expect(notices(ana.client)).toEqual([{ notice: 'adminModeOn' }]);

    ana.type('/admin');
    expect(ctx.entities.has(ana.entity, 'adminMode')).toBe(false);
    expect(ana.client.received).toContainEqual({ t: 'adminMode', on: false });
    expect(notices(ana.client)).toEqual([{ notice: 'adminModeOff' }]);
  });

  it('hides the admin from the other players', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana', 'admin');
    const bob = await join('Bob');
    bob.client.send({ t: 'viewport', w: 320, h: 180, zoom: 4 });
    const lastSnapshot = () => bob.client.received.findLast((m) => m.t === 'snapshot');
    const seen = () => {
      const snapshot = lastSnapshot();
      return snapshot?.t === 'snapshot' ? snapshot.entities.map((e) => e.id) : [];
    };

    tick();
    expect(seen()).toContain(ana.entity);
    ana.type('/admin');
    tick();
    expect(seen()).not.toContain(ana.entity);
    expect(lastSnapshot()).toMatchObject({ gone: [ana.entity] });
    tick();
    expect(seen()).not.toContain(ana.entity);
    expect(ctx.entities.get(ana.entity, 'position')).toBeDefined();
  });

  it('walks through walls and takes no damage', async () => {
    const { ctx, tick, join } = setup();
    const ana = await join('Ana', 'admin');
    ctx.entities.set(ana.entity, 'position', { layer: LAYER.surface, x: 10.5, y: 10.5 });
    for (let y = 8; y <= 12; y++) {
      ctx.world.setTile(LAYER.surface, 12, y, 'object', 'base:wooden_wall');
    }
    const walkRight = (ticks: number, from: number) => {
      for (let i = 0; i < ticks; i++) {
        ana.client.send({ t: 'input', seq: from + i, dir: 3 });
        tick();
      }
    };

    walkRight(40, 0);
    expect(ana.position()?.x).toBeLessThan(12);
    ana.type('/admin');
    walkRight(40, 40);
    expect(ana.position()?.x).toBeGreaterThan(13);

    expect(damage(ctx, ana.entity, 5, { cause: 'starvation' })).toBe(0);
    expect(ctx.entities.get(ana.entity, 'health')).toBe(CONFIG.survival.maxHealth);
  });
});
