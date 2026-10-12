import type {
  AdminAction,
  AdminAuditEntry,
  AdminError,
  AdminPlayer,
  PlayerStatus,
} from '@8box/shared';
import type { Account } from '../accounts/account';
import type { Logger } from '../core/module';
import type { AdminStore, AuditRecord, PlayerRecord } from './store';

/** What the admin needs from the game sessions (the NetServer, or a fake in tests). */
export interface LiveSessions {
  /** Players connected right now (in the game, waiting for approval or picking a name). */
  connectedPlayerIds(): ReadonlySet<number>;
  /** A player's account changed: let them in, or out, at once. */
  applyAccount(account: Account): void;
  /** Ends the sessions of a player; false when they are not connected. */
  kick(playerId: number): boolean;
}

export type AdminResult = { ok: true } | { ok: false; error: AdminError };

type StatusAction = Exclude<AdminAction, 'kick'>;

/** Statuses each action applies to, and the status it gives. */
const TRANSITIONS: Record<StatusAction, { from: readonly PlayerStatus[]; to: PlayerStatus }> = {
  approve: { from: ['pending', 'denied'], to: 'approved' },
  deny: { from: ['pending'], to: 'denied' },
  ban: { from: ['pending', 'approved', 'denied'], to: 'banned' },
  unban: { from: ['banned'], to: 'approved' },
};

export interface AdminOptions {
  store: AdminStore;
  sessions: LiveSessions;
  log: Logger;
  /** Audit entries listed, the most recent ones. */
  auditListSize: number;
}

/**
 * The admin tab: the whitelist (approve, deny), bans and kicks. Each action is written to the audit
 * log and applied at once to the connected player.
 */
export class Admin {
  constructor(private readonly options: AdminOptions) {}

  async players(): Promise<AdminPlayer[]> {
    const connected = this.options.sessions.connectedPlayerIds();
    const records = await this.options.store.listPlayers();
    return records.map((record) => toAdminPlayer(record, connected.has(record.playerId)));
  }

  pendingCount(): Promise<number> {
    return this.options.store.countPending();
  }

  async audit(): Promise<AdminAuditEntry[]> {
    const records = await this.options.store.listAudit(this.options.auditListSize);
    return records.map(toAuditEntry);
  }

  approve(admin: Account, targetId: number): Promise<AdminResult> {
    return this.changeStatus(admin, targetId, 'approve', null);
  }

  deny(admin: Account, targetId: number): Promise<AdminResult> {
    return this.changeStatus(admin, targetId, 'deny', null);
  }

  /** `reason` is already trimmed and checked (`banBodySchema`). */
  ban(admin: Account, targetId: number, reason: string): Promise<AdminResult> {
    return this.changeStatus(admin, targetId, 'ban', reason);
  }

  unban(admin: Account, targetId: number): Promise<AdminResult> {
    return this.changeStatus(admin, targetId, 'unban', null);
  }

  /** Disconnects a player, who can come back. */
  async kick(admin: Account, targetId: number): Promise<AdminResult> {
    const refusal = await this.checkTarget(admin, targetId);
    if (refusal) {
      return refusal;
    }
    if (!this.options.sessions.kick(targetId)) {
      return { ok: false, error: 'notOnline' };
    }
    await this.options.store.record({
      adminId: admin.playerId,
      action: 'kick',
      targetId,
      reason: null,
    });
    this.options.log.info(
      { admin: admin.playerId, action: 'kick', target: targetId },
      'admin action',
    );
    return { ok: true };
  }

  private async changeStatus(
    admin: Account,
    targetId: number,
    action: StatusAction,
    reason: string | null,
  ): Promise<AdminResult> {
    const refusal = await this.checkTarget(admin, targetId, TRANSITIONS[action].from);
    if (refusal) {
      return refusal;
    }
    const status = TRANSITIONS[action].to;
    const account = await this.options.store.changeStatus(
      targetId,
      { status, banReason: status === 'banned' ? reason : null },
      { adminId: admin.playerId, action, targetId, reason },
    );
    this.options.sessions.applyAccount(account);
    this.options.log.info({ admin: admin.playerId, action, target: targetId }, 'admin action');
    return { ok: true };
  }

  /** Why the action cannot target this player; undefined when it can. */
  private async checkTarget(
    admin: Account,
    targetId: number,
    statuses?: readonly PlayerStatus[],
  ): Promise<AdminResult | undefined> {
    const target = await this.options.store.findPlayer(targetId);
    if (!target) {
      return { ok: false, error: 'notFound' };
    }
    if (target.playerId === admin.playerId) {
      return { ok: false, error: 'self' };
    }
    if (target.role === 'admin') {
      return { ok: false, error: 'targetIsAdmin' };
    }
    if (statuses && !statuses.includes(target.status)) {
      return { ok: false, error: 'wrongStatus' };
    }
    return undefined;
  }
}

function toAdminPlayer(record: PlayerRecord, online: boolean): AdminPlayer {
  return {
    id: record.playerId,
    name: record.name,
    email: record.email,
    status: record.status,
    role: record.role,
    banReason: record.banReason,
    online,
    createdAt: record.createdAt.toISOString(),
    lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
  };
}

function toAuditEntry(record: AuditRecord): AdminAuditEntry {
  return { ...record, at: record.at.toISOString() };
}
