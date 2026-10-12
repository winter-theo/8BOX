import { PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { Accounts, type ClerkIdentity } from '../accounts/Accounts';
import { MemoryAccountStore } from '../accounts/account';
import { connectFakeClient, createTestContext, settle } from '../core/testing';
import { playersModule } from '../modules/players';
import { CloseCode } from '../net/net';
import { Admin } from './Admin';
import { MemoryAdminStore } from './store';

/** Clerk stand-in: `token-<user>` is valid for `user_<user>` (email `<user>@mail.test`). */
const fakeClerk: ClerkIdentity = {
  async verify(token) {
    return token.startsWith('token-') ? `user_${token.slice('token-'.length)}` : undefined;
  },
  async email(userId) {
    return `${userId.slice('user_'.length)}@mail.test`;
  },
};

/** The admin acting on real game sessions (fake sockets). */
async function setup() {
  const accountStore = new MemoryAccountStore();
  const accounts = new Accounts(accountStore, fakeClerk, ['boss@mail.test']);
  const { ctx } = createTestContext({ accounts, modules: [playersModule] });
  const store = new MemoryAdminStore(accountStore);
  const admin = new Admin({ store, sessions: ctx.net, log: ctx.log, auditListSize: 100 });
  const boss = await accountStore.create({
    clerkUserId: 'user_boss',
    email: 'boss@mail.test',
    name: 'Boss',
    status: 'approved',
    role: 'admin',
  });
  const connect = async (token: string, name?: string) => {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, token });
    await settle();
    if (name !== undefined) {
      client.send({ t: 'setName', name });
      await settle();
    }
    return client;
  };
  const accountOf = (name: string) => {
    const account = accountStore.accounts.find((candidate) => candidate.name === name);
    if (!account) {
      throw new Error(`No account ${name}`);
    }
    return account;
  };
  return { ctx, admin, store, boss, connect, accountOf };
}

describe('admin actions on connected players', () => {
  it('lets a waiting player into the game as soon as they are approved', async () => {
    const { admin, boss, connect, accountOf } = await setup();
    const client = await connect('token-ana', 'Ana');
    expect(client.last()).toEqual({ t: 'status', state: 'pending' });

    expect(await admin.approve(boss, accountOf('Ana').playerId)).toEqual({ ok: true });

    expect(client.last()).toMatchObject({ t: 'welcome', you: { name: 'Ana' } });
    expect(client.session.state).toBe('playing');
    expect(client.closed).toBeUndefined();
  });

  it('approves a player still picking a name: they enter once named', async () => {
    const { admin, boss, connect, store } = await setup();
    const client = await connect('token-ana');
    const playerId = client.session.account?.playerId ?? -1;

    await admin.approve(boss, playerId);
    expect(client.last()).toEqual({ t: 'status', state: 'needsName' });

    client.send({ t: 'setName', name: 'Ana' });
    await settle();
    expect(client.last()).toMatchObject({ t: 'welcome' });
    expect(store.audit[0]).toMatchObject({ action: 'approve', targetId: playerId });
  });

  it('sends a denied waiting player the denied screen, then closes', async () => {
    const { admin, boss, connect, accountOf } = await setup();
    const client = await connect('token-ana', 'Ana');

    await admin.deny(boss, accountOf('Ana').playerId);

    expect(client.last()).toEqual({ t: 'status', state: 'denied' });
    expect(client.closed?.code).toBe(CloseCode.normal);
  });

  it('bans a player in the game: banned screen with the reason, player removed', async () => {
    const { ctx, admin, boss, connect, accountOf, store } = await setup();
    const client = await connect('token-ana', 'Ana');
    await admin.approve(boss, accountOf('Ana').playerId);
    const entity = client.session.player?.entity ?? -1;

    await admin.ban(boss, accountOf('Ana').playerId, 'griefing');

    expect(client.last()).toEqual({ t: 'status', state: 'banned', reason: 'griefing' });
    expect(client.closed?.code).toBe(CloseCode.normal);
    expect(ctx.entities.exists(entity)).toBe(false);
    expect(store.audit.map((entry) => entry.action)).toEqual(['ban', 'approve']);

    // Coming back is refused too.
    const again = await connect('token-ana');
    expect(again.last()).toEqual({ t: 'status', state: 'banned', reason: 'griefing' });
  });

  it('kicks a player out with the kicked screen; they can come back', async () => {
    const { admin, boss, connect, accountOf, store } = await setup();
    const client = await connect('token-ana', 'Ana');
    await admin.approve(boss, accountOf('Ana').playerId);
    expect((await admin.players()).find((player) => player.name === 'Ana')?.online).toBe(true);

    expect(await admin.kick(boss, accountOf('Ana').playerId)).toEqual({ ok: true });

    expect(client.last()).toEqual({ t: 'rejected', reason: 'kicked' });
    expect(client.closed).toBeDefined();
    expect((await admin.players()).find((player) => player.name === 'Ana')?.online).toBe(false);
    expect(store.audit[0]).toMatchObject({ action: 'kick', adminName: 'Boss', targetName: 'Ana' });

    const again = await connect('token-ana');
    expect(again.last()).toMatchObject({ t: 'welcome' });
  });
});
