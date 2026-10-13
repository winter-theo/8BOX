import type { AdminAction } from '@8box/shared';
import type { Account, MemoryAccountStore } from '../accounts/account';

/** An account with its dates, as the admin tab lists it. */
export interface PlayerRecord extends Account {
  createdAt: Date;
  lastSeenAt: Date | null;
}

/** One admin action of the audit log, with the names of the admin and of the target. */
export interface AuditRecord {
  id: number;
  at: Date;
  action: AdminAction;
  adminId: number;
  adminName: string | null;
  targetId: number;
  targetName: string | null;
  reason: string | null;
  /** Length of a mute, in minutes. */
  minutes: number | null;
}

export type NewAuditRecord = Pick<
  AuditRecord,
  'adminId' | 'action' | 'targetId' | 'reason' | 'minutes'
>;

/** What an admin action changes in an account: its status (and ban reason), or its mute. */
export type AccountChange = Partial<Pick<Account, 'status' | 'banReason' | 'mutedUntil'>>;

/** Where the admin tab reads players and writes its actions: the database, or memory in tests. */
export interface AdminStore {
  /** Every player, the most recent first. */
  listPlayers(): Promise<PlayerRecord[]>;
  findPlayer(playerId: number): Promise<PlayerRecord | undefined>;
  countPending(): Promise<number>;
  /** Changes an account and writes the action to the audit log, together. */
  changeAccount(
    playerId: number,
    change: AccountChange,
    audit: NewAuditRecord,
  ): Promise<PlayerRecord>;
  /** Writes an action that changes nothing else (a kick). */
  record(audit: NewAuditRecord): Promise<void>;
  /** The most recent actions first. */
  listAudit(limit: number): Promise<AuditRecord[]>;
}

/** Admin data kept in memory, over the accounts of a MemoryAccountStore: for tests. */
export class MemoryAdminStore implements AdminStore {
  readonly audit: AuditRecord[] = [];

  constructor(private readonly accounts: MemoryAccountStore) {}

  async listPlayers() {
    return this.accounts.accounts.map((account) => this.toRecord(account)).reverse();
  }

  async findPlayer(playerId: number) {
    const account = this.accounts.accounts.find((candidate) => candidate.playerId === playerId);
    return account && this.toRecord(account);
  }

  async countPending() {
    return this.accounts.accounts.filter((account) => account.status === 'pending').length;
  }

  async changeAccount(playerId: number, change: AccountChange, audit: NewAuditRecord) {
    const account = await this.accounts.update(playerId, change);
    await this.record(audit);
    return this.toRecord(account);
  }

  async record(audit: NewAuditRecord) {
    this.audit.unshift({
      ...audit,
      id: this.audit.length + 1,
      at: new Date(),
      adminName: (await this.findPlayer(audit.adminId))?.name ?? null,
      targetName: (await this.findPlayer(audit.targetId))?.name ?? null,
    });
  }

  async listAudit(limit: number) {
    return this.audit.slice(0, limit);
  }

  private toRecord(account: Account): PlayerRecord {
    return { ...account, createdAt: new Date(0), lastSeenAt: null };
  }
}
