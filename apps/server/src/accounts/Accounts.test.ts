import { describe, expect, it } from 'vitest';
import { Accounts, type ClerkIdentity } from './Accounts';
import { MemoryAccountStore } from './account';

/** Clerk stand-in: `token-<user>` is the valid token of `user_<user>`, whose email is `<user>@mail.test`. */
const fakeClerk: ClerkIdentity = {
  async verify(token) {
    return token.startsWith('token-') ? `user_${token.slice('token-'.length)}` : undefined;
  },
  async email(userId) {
    return `${userId.slice('user_'.length)}@mail.test`;
  },
};

function setup(adminEmails: string[] = ['boss@mail.test']) {
  const store = new MemoryAccountStore();
  return { store, accounts: new Accounts(store, fakeClerk, adminEmails) };
}

describe('Accounts', () => {
  it('creates a pending account without a name at the first sign-in, then finds it again', async () => {
    const { accounts, store } = setup();

    const account = await accounts.signIn('token-ana');

    expect(account).toMatchObject({
      clerkUserId: 'user_ana',
      email: 'ana@mail.test',
      name: null,
      status: 'pending',
      role: 'player',
    });
    expect(await accounts.signIn('token-ana')).toEqual(account);
    expect(store.accounts).toHaveLength(1);
  });

  it('refuses an invalid or expired token, and every token without Clerk', async () => {
    const { accounts } = setup();
    expect(await accounts.signIn('expired')).toBeUndefined();

    const withoutClerk = new Accounts(new MemoryAccountStore(), undefined, []);
    expect(await withoutClerk.signIn('token-ana')).toBeUndefined();
  });

  it('makes the admin emails admins, approved at once', async () => {
    const { accounts } = setup(['Boss@Mail.test']);

    expect(await accounts.signIn('token-boss')).toMatchObject({
      status: 'approved',
      role: 'admin',
    });
  });

  it('promotes an existing account whose email became an admin email', async () => {
    const store = new MemoryAccountStore();
    await new Accounts(store, fakeClerk, []).signIn('token-boss');

    const account = await new Accounts(store, fakeClerk, ['boss@mail.test']).signIn('token-boss');

    expect(account).toMatchObject({ status: 'approved', role: 'admin' });
  });

  it('signs dev names in as approved accounts, case-insensitively', async () => {
    const { accounts, store } = setup();

    const first = await accounts.devSignIn('Bot_01');
    const again = await accounts.devSignIn('bot_01');

    expect(first).toMatchObject({ name: 'Bot_01', status: 'approved', clerkUserId: null });
    expect(again.playerId).toBe(first.playerId);
    expect(store.accounts).toHaveLength(1);
  });

  it('gives a valid and free name, and says why it refuses one', async () => {
    const { accounts } = setup();
    const ana = await accounts.signIn('token-ana');
    const bob = await accounts.signIn('token-bob');
    if (!ana || !bob) {
      throw new Error('sign-in failed');
    }

    expect(await accounts.setName(ana.playerId, 'a b')).toEqual({ ok: false, error: 'invalid' });
    expect(await accounts.setName(ana.playerId, 'Connard')).toEqual({
      ok: false,
      error: 'forbidden',
    });
    const named = await accounts.setName(ana.playerId, 'Ana');
    expect(named).toMatchObject({ ok: true, account: { name: 'Ana', status: 'pending' } });
    // Unique whatever the case.
    expect(await accounts.setName(bob.playerId, 'ANA')).toEqual({ ok: false, error: 'taken' });
  });
});
