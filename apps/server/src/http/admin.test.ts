import type { AdminAuditResponse, AdminMe, AdminPlayersResponse } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { Accounts, type ClerkIdentity } from '../accounts/Accounts';
import { type Account, MemoryAccountStore, type NewAccount } from '../accounts/account';
import { Admin, type LiveSessions } from '../admin/Admin';
import { MemoryAdminStore } from '../admin/store';
import { buildApp } from '../app';
import { createTestContext } from '../core/testing';

/** Clerk stand-in: `token-<user>` is the valid token of `user_<user>`. */
const fakeClerk: ClerkIdentity = {
  async verify(token) {
    return token.startsWith('token-') ? `user_${token.slice('token-'.length)}` : undefined;
  },
  async email(userId) {
    return `${userId.slice('user_'.length)}@mail.test`;
  },
};

/** Game sessions stand-in: remembers what the admin applied. */
class FakeSessions implements LiveSessions {
  readonly connected = new Set<number>();
  readonly applied: Account[] = [];
  readonly kicked: number[] = [];

  connectedPlayerIds() {
    return this.connected;
  }
  applyAccount(account: Account) {
    this.applied.push({ ...account });
  }
  kick(playerId: number) {
    if (!this.connected.has(playerId)) {
      return false;
    }
    this.connected.delete(playerId);
    this.kicked.push(playerId);
    return true;
  }
}

function player(clerk: string, changes: Partial<NewAccount> = {}): NewAccount {
  return {
    clerkUserId: `user_${clerk}`,
    email: `${clerk}@mail.test`,
    name: clerk,
    status: 'approved',
    role: 'player',
    ...changes,
  };
}

async function setup({ devAuth = false } = {}) {
  const accountStore = new MemoryAccountStore();
  const store = new MemoryAdminStore(accountStore);
  const sessions = new FakeSessions();
  const { ctx } = createTestContext();
  const admin = new Admin({ store, sessions, log: ctx.log, auditListSize: 100 });
  const boss = await accountStore.create(player('boss', { role: 'admin' }));
  const ana = await accountStore.create(player('ana'));
  const newbie = await accountStore.create(player('newbie', { status: 'pending' }));
  const app = buildApp({
    admin: { admin, accounts: new Accounts(accountStore, fakeClerk, []), devAuth },
    allowedOrigins: ['http://game.test'],
  });

  const request = (method: 'GET' | 'POST', url: string, token = 'token-boss', payload?: object) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload && { payload }),
    });
  return { app, store, sessions, accountStore, boss, ana, newbie, request };
}

describe('admin API guard', () => {
  it('answers 403 to a player who is not an admin, on every route', async () => {
    const { request, newbie } = await setup();
    for (const [method, url] of [
      ['GET', '/admin/me'],
      ['GET', '/admin/players'],
      ['GET', '/admin/audit'],
      ['POST', `/admin/players/${newbie.playerId}/approve`],
    ] as const) {
      const response = await request(method, url, 'token-ana');
      expect(response.statusCode, url).toBe(403);
      expect(response.json()).toEqual({ error: 'forbidden' });
    }
  });

  it('answers 401 without a token, with a bad one, or for an unknown user', async () => {
    const { app, request } = await setup();
    expect((await app.inject({ method: 'GET', url: '/admin/me' })).statusCode).toBe(401);
    expect((await request('GET', '/admin/me', 'forged')).statusCode).toBe(401);
    expect((await request('GET', '/admin/me', 'token-stranger')).statusCode).toBe(401);
  });

  it('refuses a banned admin', async () => {
    const { request, accountStore, boss } = await setup();
    await accountStore.update(boss.playerId, { status: 'banned' });
    expect((await request('GET', '/admin/me')).statusCode).toBe(403);
  });

  it('accepts `Dev <name>` in dev mode only', async () => {
    const dev = await setup({ devAuth: true });
    const devRequest = (name: string) =>
      dev.app.inject({
        method: 'GET',
        url: '/admin/me',
        headers: { authorization: `Dev ${name}` },
      });
    expect((await devRequest('boss')).statusCode).toBe(200);
    expect((await devRequest('ana')).statusCode).toBe(403);

    const prod = await setup();
    const response = await prod.app.inject({
      method: 'GET',
      url: '/admin/me',
      headers: { authorization: 'Dev boss' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('answers the CORS preflight of an allowed origin', async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/admin/players',
      headers: { origin: 'http://game.test', 'access-control-request-method': 'GET' },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://game.test');
    expect(response.headers['access-control-allow-headers']).toContain('authorization');
  });
});

describe('admin API', () => {
  it('lists the players with their status and connection, and counts the pending ones', async () => {
    const { request, sessions, ana } = await setup();
    sessions.connected.add(ana.playerId);

    const me = (await request('GET', '/admin/me')).json<AdminMe>();
    const { players } = (await request('GET', '/admin/players')).json<AdminPlayersResponse>();

    expect(me).toEqual({ pendingCount: 1 });
    expect(players.map(({ name, status, online }) => ({ name, status, online }))).toEqual([
      { name: 'newbie', status: 'pending', online: false },
      { name: 'ana', status: 'approved', online: true },
      { name: 'boss', status: 'approved', online: false },
    ]);
    expect(players[0]).toMatchObject({ email: 'newbie@mail.test', role: 'player' });
  });

  it('approves a pending player: new status, applied to the game, written to the audit', async () => {
    const { request, store, sessions, accountStore, boss, newbie } = await setup();

    const response = await request('POST', `/admin/players/${newbie.playerId}/approve`);

    expect(response.statusCode).toBe(200);
    expect(accountStore.accounts[2]?.status).toBe('approved');
    expect(sessions.applied).toEqual([
      expect.objectContaining({ name: 'newbie', status: 'approved' }),
    ]);
    expect(store.audit).toEqual([
      expect.objectContaining({
        action: 'approve',
        adminId: boss.playerId,
        adminName: 'boss',
        targetId: newbie.playerId,
        targetName: 'newbie',
        reason: null,
      }),
    ]);
  });

  it('denies a pending player', async () => {
    const { request, store, accountStore, newbie } = await setup();
    expect((await request('POST', `/admin/players/${newbie.playerId}/deny`)).statusCode).toBe(200);
    expect(accountStore.accounts[2]?.status).toBe('denied');
    expect(store.audit[0]?.action).toBe('deny');
  });

  it('bans with a reason, then unbans', async () => {
    const { request, store, sessions, accountStore, ana } = await setup();

    const ban = await request('POST', `/admin/players/${ana.playerId}/ban`, 'token-boss', {
      reason: '  griefing  ',
    });

    expect(ban.statusCode).toBe(200);
    expect(accountStore.accounts[1]).toMatchObject({ status: 'banned', banReason: 'griefing' });
    expect(sessions.applied.at(-1)).toMatchObject({ status: 'banned', banReason: 'griefing' });
    expect(store.audit[0]).toMatchObject({ action: 'ban', targetName: 'ana', reason: 'griefing' });

    expect((await request('POST', `/admin/players/${ana.playerId}/unban`)).statusCode).toBe(200);
    expect(accountStore.accounts[1]).toMatchObject({ status: 'approved', banReason: null });

    const { entries } = (await request('GET', '/admin/audit')).json<AdminAuditResponse>();
    expect(entries.map((entry) => entry.action)).toEqual(['unban', 'ban']);
  });

  it('refuses a ban without a reason, or with a too long one', async () => {
    const { request, store, ana } = await setup();
    const url = `/admin/players/${ana.playerId}/ban`;
    expect((await request('POST', url, 'token-boss', { reason: '   ' })).statusCode).toBe(400);
    expect((await request('POST', url, 'token-boss', { reason: 'x'.repeat(201) })).statusCode).toBe(
      400,
    );
    expect((await request('POST', url)).json()).toEqual({ error: 'invalidBody' });
    expect(store.audit).toEqual([]);
  });

  it('kicks a connected player, and refuses when they are not connected', async () => {
    const { request, store, sessions, ana } = await setup();
    sessions.connected.add(ana.playerId);

    expect((await request('POST', `/admin/players/${ana.playerId}/kick`)).statusCode).toBe(200);
    expect(sessions.kicked).toEqual([ana.playerId]);
    expect(store.audit[0]).toMatchObject({ action: 'kick', targetName: 'ana' });

    const again = await request('POST', `/admin/players/${ana.playerId}/kick`);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'notOnline' });
  });

  it('refuses actions that do not fit, and writes nothing to the audit', async () => {
    const { request, store, sessions, boss, ana } = await setup();

    const cases = [
      [`/admin/players/${ana.playerId}/approve`, 409, 'wrongStatus'],
      [`/admin/players/${ana.playerId}/unban`, 409, 'wrongStatus'],
      [`/admin/players/${boss.playerId}/deny`, 409, 'self'],
      ['/admin/players/999/approve', 404, 'notFound'],
      ['/admin/players/abc/approve', 404, 'notFound'],
      [`/admin/players/${ana.playerId}/promote`, 404, 'notFound'],
    ] as const;
    for (const [url, status, error] of cases) {
      const response = await request('POST', url);
      expect(response.statusCode, url).toBe(status);
      expect(response.json(), url).toEqual({ error });
    }
    expect(store.audit).toEqual([]);
    expect(sessions.applied).toEqual([]);
  });

  it('never acts on another admin', async () => {
    const { request, accountStore } = await setup();
    const second = await accountStore.create(player('chief', { role: 'admin' }));
    const response = await request('POST', `/admin/players/${second.playerId}/ban`, 'token-boss', {
      reason: 'test',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'targetIsAdmin' });
  });
});
