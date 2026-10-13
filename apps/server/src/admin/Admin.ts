import {
  type AdminAction,
  type AdminAuditEntry,
  type AdminError,
  type AdminMe,
  type AdminPlayer,
  type AdminReport,
  MINUTE_MS,
  type PlayerStatus,
  type ReportAction,
} from '@8box/shared';
import type { Account } from '../accounts/account';
import type { Logger } from '../core/module';
import type { ReportClosing, ReportRecord, ReportStore } from '../reports/store';
import type { AccountChange, AdminStore, AuditRecord, PlayerRecord } from './store';

/** What the admin needs from the game sessions (the NetServer, or a fake in tests). */
export interface LiveSessions {
  /** Players connected right now (in the game, waiting for approval or picking a name). */
  connectedPlayerIds(): ReadonlySet<number>;
  /** A player's account changed: let them in, or out, at once (or mute them). */
  applyAccount(account: Account): void;
  /** Ends the sessions of a player; false when they are not connected. */
  kick(playerId: number): boolean;
}

export type AdminResult = { ok: true } | { ok: false; error: AdminError };

/** The player an action targets, or why it cannot. */
type TargetCheck = { ok: true; target: PlayerRecord } | { ok: false; error: AdminError };

type StatusAction = Exclude<AdminAction, 'kick' | 'mute' | 'unmute'>;

/** Statuses each action applies to, and the status it gives. */
const TRANSITIONS: Record<StatusAction, { from: readonly PlayerStatus[]; to: PlayerStatus }> = {
  approve: { from: ['pending', 'denied'], to: 'approved' },
  deny: { from: ['pending'], to: 'denied' },
  ban: { from: ['pending', 'approved', 'denied'], to: 'banned' },
  unban: { from: ['banned'], to: 'approved' },
};

/** Status a report gets from each action. */
const CLOSINGS: Record<ReportAction, ReportClosing> = {
  resolve: 'resolved',
  dismiss: 'dismissed',
};

export interface AdminOptions {
  store: AdminStore;
  reports: ReportStore;
  sessions: LiveSessions;
  log: Logger;
  /** Audit entries listed, the most recent ones. */
  auditListSize: number;
  /** Reports listed, the open ones first. */
  reportListSize: number;
  /** Clock of the mutes, in ms since 1970 (default: Date.now). */
  now?: () => number;
}

/**
 * The admin tab: the whitelist (approve, deny), bans, kicks, mutes and the reports of players. Each
 * action on a player is written to the audit log and applied at once to the connected player.
 */
export class Admin {
  private readonly now: () => number;

  constructor(private readonly options: AdminOptions) {
    this.now = options.now ?? Date.now;
  }

  async players(): Promise<AdminPlayer[]> {
    const connected = this.options.sessions.connectedPlayerIds();
    const records = await this.options.store.listPlayers();
    return records.map((record) => toAdminPlayer(record, connected.has(record.playerId)));
  }

  /** What the menu link shows: requests waiting and reports to read. */
  async me(): Promise<AdminMe> {
    const [pendingCount, openReportCount] = await Promise.all([
      this.options.store.countPending(),
      this.options.reports.countOpen(),
    ]);
    return { pendingCount, openReportCount };
  }

  async audit(): Promise<AdminAuditEntry[]> {
    const records = await this.options.store.listAudit(this.options.auditListSize);
    return records.map(toAuditEntry);
  }

  async reports(): Promise<AdminReport[]> {
    const records = await this.options.reports.list(this.options.reportListSize);
    return records.map(toAdminReport);
  }

  /** Resolves or dismisses an open report. */
  async closeReport(admin: Account, reportId: number, action: ReportAction): Promise<AdminResult> {
    if (!(await this.options.reports.close(reportId, CLOSINGS[action], admin.playerId))) {
      return { ok: false, error: 'reportClosed' };
    }
    this.options.log.info({ admin: admin.playerId, action, report: reportId }, 'admin action');
    return { ok: true };
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

  /** The player cannot chat for `minutes` (already checked, `muteBodySchema`); replaces a mute. */
  async mute(admin: Account, targetId: number, minutes: number): Promise<AdminResult> {
    const check = await this.checkTarget(admin, targetId, ['approved']);
    if (!check.ok) {
      return check;
    }
    const mutedUntil = new Date(this.now() + minutes * MINUTE_MS);
    return this.change(admin, targetId, { mutedUntil }, { action: 'mute', minutes });
  }

  /** Gives the chat back to a muted player. */
  async unmute(admin: Account, targetId: number): Promise<AdminResult> {
    const check = await this.checkTarget(admin, targetId);
    if (!check.ok) {
      return check;
    }
    const { mutedUntil } = check.target;
    if (!mutedUntil || mutedUntil.getTime() <= this.now()) {
      return { ok: false, error: 'wrongStatus' };
    }
    return this.change(admin, targetId, { mutedUntil: null }, { action: 'unmute' });
  }

  /** Disconnects a player, who can come back. */
  async kick(admin: Account, targetId: number): Promise<AdminResult> {
    const check = await this.checkTarget(admin, targetId);
    if (!check.ok) {
      return check;
    }
    if (!this.options.sessions.kick(targetId)) {
      return { ok: false, error: 'notOnline' };
    }
    await this.options.store.record({
      adminId: admin.playerId,
      action: 'kick',
      targetId,
      reason: null,
      minutes: null,
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
    const check = await this.checkTarget(admin, targetId, TRANSITIONS[action].from);
    if (!check.ok) {
      return check;
    }
    const status = TRANSITIONS[action].to;
    return this.change(
      admin,
      targetId,
      { status, banReason: status === 'banned' ? reason : null },
      { action, reason },
    );
  }

  /** Changes the account, writes the action to the audit log and applies it to the game. */
  private async change(
    admin: Account,
    targetId: number,
    change: AccountChange,
    audit: { action: AdminAction; reason?: string | null; minutes?: number },
  ): Promise<AdminResult> {
    const account = await this.options.store.changeAccount(targetId, change, {
      adminId: admin.playerId,
      action: audit.action,
      targetId,
      reason: audit.reason ?? null,
      minutes: audit.minutes ?? null,
    });
    this.options.sessions.applyAccount(account);
    this.options.log.info(
      { admin: admin.playerId, action: audit.action, target: targetId },
      'admin action',
    );
    return { ok: true };
  }

  /** The player the action targets, unless it cannot target them. */
  private async checkTarget(
    admin: Account,
    targetId: number,
    statuses?: readonly PlayerStatus[],
  ): Promise<TargetCheck> {
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
    return { ok: true, target };
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
    mutedUntil: record.mutedUntil?.toISOString() ?? null,
    online,
    createdAt: record.createdAt.toISOString(),
    lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
  };
}

function toAuditEntry(record: AuditRecord): AdminAuditEntry {
  return { ...record, at: record.at.toISOString() };
}

function toAdminReport(record: ReportRecord): AdminReport {
  return {
    ...record,
    at: record.at.toISOString(),
    handledAt: record.handledAt?.toISOString() ?? null,
  };
}
