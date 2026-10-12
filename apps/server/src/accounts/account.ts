/** Where a player stands on the whitelist. */
export type AccountStatus = 'pending' | 'approved' | 'denied' | 'banned';
export type AccountRole = 'player' | 'admin';

/** A player account (a `players` row). */
export interface Account {
  playerId: number;
  /** Clerk user id; null for dev players (DEV_AUTH). */
  clerkUserId: string | null;
  email: string | null;
  /** Chosen after the first sign-in; null until then. */
  name: string | null;
  status: AccountStatus;
  role: AccountRole;
  banReason: string | null;
}

export type NewAccount = Pick<Account, 'clerkUserId' | 'email' | 'name' | 'status' | 'role'>;

/** Where accounts are kept: the database, or memory in tests. Names are unique, case-insensitive. */
export interface AccountStore {
  findByClerkId(clerkUserId: string): Promise<Account | undefined>;
  findByName(name: string): Promise<Account | undefined>;
  create(account: NewAccount): Promise<Account>;
  update(
    playerId: number,
    changes: Partial<Pick<Account, 'status' | 'role' | 'email'>>,
  ): Promise<Account>;
  /** Gives a name; 'taken' when another player has it (whatever the case). */
  setName(playerId: number, name: string): Promise<Account | 'taken'>;
}

/** Accounts kept in memory: for tests. */
export class MemoryAccountStore implements AccountStore {
  readonly accounts: Account[] = [];

  async findByClerkId(clerkUserId: string) {
    return this.accounts.find((account) => account.clerkUserId === clerkUserId);
  }

  async findByName(name: string) {
    return this.accounts.find((account) => account.name?.toLowerCase() === name.toLowerCase());
  }

  async create(account: NewAccount) {
    const created: Account = { ...account, playerId: this.accounts.length + 1, banReason: null };
    this.accounts.push(created);
    return created;
  }

  async update(playerId: number, changes: Partial<Account>) {
    const account = this.get(playerId);
    Object.assign(account, changes);
    return account;
  }

  async setName(playerId: number, name: string) {
    const owner = await this.findByName(name);
    if (owner && owner.playerId !== playerId) {
      return 'taken' as const;
    }
    return this.update(playerId, { name });
  }

  private get(playerId: number): Account {
    const account = this.accounts.find((candidate) => candidate.playerId === playerId);
    if (!account) {
      throw new Error(`No player ${playerId}`);
    }
    return account;
  }
}
