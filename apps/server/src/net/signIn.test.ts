import { PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { Accounts, type ClerkIdentity } from '../accounts/Accounts';
import { MemoryAccountStore } from '../accounts/account';
import { connectFakeClient, createTestContext, settle } from '../core/testing';
import { playersModule } from '../modules/players';
import { CloseCode } from './net';

/** Clerk stand-in: `token-<user>` is valid for `user_<user>` (email `<user>@mail.test`). */
const fakeClerk: ClerkIdentity = {
  async verify(token) {
    return token.startsWith('token-') ? `user_${token.slice('token-'.length)}` : undefined;
  },
  async email(userId) {
    return `${userId.slice('user_'.length)}@mail.test`;
  },
};

function setup() {
  const store = new MemoryAccountStore();
  const accounts = new Accounts(store, fakeClerk, ['boss@mail.test']);
  const { ctx } = createTestContext({ accounts, modules: [playersModule] });
  const connect = async (token: string) => {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, token });
    await settle();
    return client;
  };
  /** An account that already exists, in some state. */
  const existing = (user: string, changes: Partial<(typeof store.accounts)[number]>) =>
    store.accounts.push({
      playerId: store.accounts.length + 1,
      clerkUserId: `user_${user}`,
      email: `${user}@mail.test`,
      name: null,
      status: 'pending',
      role: 'player',
      banReason: null,
      ...changes,
    });
  return { ctx, store, connect, existing };
}

describe('sign-in and whitelist', () => {
  it('refuses an invalid or expired token', async () => {
    const { connect } = setup();

    const client = await connect('expired-token');

    expect(client.received).toEqual([{ t: 'rejected', reason: 'invalidToken' }]);
    expect(client.closed?.code).toBe(CloseCode.normal);
  });

  it('asks a new player for a name, then makes them wait for the admin', async () => {
    const { connect, store } = setup();
    const client = await connect('token-ana');
    expect(client.last()).toEqual({ t: 'status', state: 'needsName' });
    expect(client.session.state).toBe('naming');

    client.send({ t: 'setName', name: 'bad name' });
    await settle();
    expect(client.last()).toEqual({ t: 'status', state: 'needsName', nameError: 'invalid' });

    client.send({ t: 'setName', name: 'Ana' });
    await settle();
    expect(client.last()).toEqual({ t: 'status', state: 'pending' });
    expect(client.session.state).toBe('waiting');
    expect(client.closed).toBeUndefined();
    expect(store.accounts[0]).toMatchObject({ name: 'Ana', status: 'pending' });
  });

  it('refuses a name another player has, whatever its case', async () => {
    const { connect, existing } = setup();
    existing('bob', { name: 'Bob', status: 'approved' });
    const client = await connect('token-ana');

    client.send({ t: 'setName', name: 'BOB' });
    await settle();

    expect(client.last()).toEqual({ t: 'status', state: 'needsName', nameError: 'taken' });
  });

  it('lets an approved player in, and keeps a pending one waiting', async () => {
    const { ctx, connect, existing } = setup();
    existing('ana', { name: 'Ana', status: 'approved' });
    existing('bob', { name: 'Bob', status: 'pending' });

    const ana = await connect('token-ana');
    const bob = await connect('token-bob');

    expect(ana.last()).toMatchObject({ t: 'welcome', you: { name: 'Ana' } });
    expect(ctx.entities.get(ana.session.player?.entity ?? -1, 'player')).toEqual({
      name: 'Ana',
      playerId: 1,
    });
    expect(bob.last()).toEqual({ t: 'status', state: 'pending' });
    expect(bob.session.player).toBeUndefined();
  });

  it('tells a banned or denied player why, then closes', async () => {
    const { connect, existing } = setup();
    existing('ana', { name: 'Ana', status: 'banned', banReason: 'griefing' });
    existing('bob', { name: 'Bob', status: 'denied' });

    const ana = await connect('token-ana');
    const bob = await connect('token-bob');

    expect(ana.received).toEqual([{ t: 'status', state: 'banned', reason: 'griefing' }]);
    expect(ana.closed).toBeDefined();
    expect(bob.received).toEqual([{ t: 'status', state: 'denied' }]);
    expect(bob.closed).toBeDefined();
  });

  it('lets an admin in as soon as they have a name', async () => {
    const { connect } = setup();
    const boss = await connect('token-boss');

    boss.send({ t: 'setName', name: 'Boss' });
    await settle();

    expect(boss.last()).toMatchObject({ t: 'welcome', you: { name: 'Boss' } });
  });

  it('ignores setName outside of the name choice', async () => {
    const { connect, existing, store } = setup();
    existing('ana', { name: 'Ana', status: 'pending' });
    const ana = await connect('token-ana');

    ana.send({ t: 'setName', name: 'Other' });
    await settle();

    expect(store.accounts[0]?.name).toBe('Ana');
    expect(ana.last()).toEqual({ t: 'status', state: 'pending' });
  });

  it('ends the older session of a player who connects again', async () => {
    const { connect, existing } = setup();
    existing('ana', { name: 'Ana', status: 'approved' });

    const first = await connect('token-ana');
    const second = await connect('token-ana');

    expect(first.last()).toEqual({ t: 'rejected', reason: 'replaced' });
    expect(second.last()).toMatchObject({ t: 'welcome' });
  });
});
