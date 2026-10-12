import { checkPlayerName, type NameError } from '@8box/shared';
import type { Account, AccountStore } from './account';

/** Who a session token belongs to (Clerk, or a fake in tests). */
export interface ClerkIdentity {
  /** Clerk user id of a session token; undefined when the token is invalid or expired. */
  verify(token: string): Promise<string | undefined>;
  /** Email of a Clerk user (read once, at their first sign-in). */
  email(userId: string): Promise<string | undefined>;
}

export type SetNameResult = { ok: true; account: Account } | { ok: false; error: NameError };

/**
 * Sign-in and the whitelist. A new Clerk user gets a `pending` account and picks a name; the admin
 * approves them (step 12). The emails of `ADMIN_EMAILS` are admins, approved at once. In dev mode, a
 * name alone signs in (an approved account without Clerk).
 */
export class Accounts {
  private readonly adminEmails: ReadonlySet<string>;

  constructor(
    private readonly store: AccountStore,
    /** Undefined when the server has no Clerk key: only dev sign-ins then. */
    private readonly identity: ClerkIdentity | undefined,
    adminEmails: readonly string[],
  ) {
    this.adminEmails = new Set(adminEmails.map((email) => email.toLowerCase()));
  }

  /** The account of a session token, created at the first sign-in; undefined for a bad token. */
  async signIn(token: string): Promise<Account | undefined> {
    const userId = await this.identity?.verify(token);
    if (userId === undefined) {
      return undefined;
    }
    const account = await this.store.findByClerkId(userId);
    if (!account) {
      const email = (await this.identity?.email(userId)) ?? null;
      const admin = this.isAdminEmail(email);
      return this.store.create({
        clerkUserId: userId,
        email,
        name: null,
        status: admin ? 'approved' : 'pending',
        role: admin ? 'admin' : 'player',
      });
    }
    if (
      this.isAdminEmail(account.email) &&
      (account.role !== 'admin' || account.status !== 'approved')
    ) {
      return this.store.update(account.playerId, { role: 'admin', status: 'approved' });
    }
    return account;
  }

  /** The existing account of a session token, without creating one (admin API). */
  async findByToken(token: string): Promise<Account | undefined> {
    const userId = await this.identity?.verify(token);
    return userId === undefined ? undefined : this.store.findByClerkId(userId);
  }

  /** The existing account of a name (dev mode). */
  findByName(name: string): Promise<Account | undefined> {
    return this.store.findByName(name);
  }

  /** Dev mode: the account of a name, created approved at the first sign-in. */
  async devSignIn(name: string): Promise<Account> {
    return (
      (await this.store.findByName(name)) ??
      this.store.create({
        clerkUserId: null,
        email: null,
        name,
        status: 'approved',
        role: 'player',
      })
    );
  }

  /** Gives a player the name they chose, if it is valid and free. */
  async setName(playerId: number, name: string): Promise<SetNameResult> {
    const check = checkPlayerName(name);
    if (check !== 'ok') {
      return { ok: false, error: check };
    }
    const result = await this.store.setName(playerId, name);
    return result === 'taken' ? { ok: false, error: 'taken' } : { ok: true, account: result };
  }

  private isAdminEmail(email: string | null): boolean {
    return email !== null && this.adminEmails.has(email.toLowerCase());
  }
}
