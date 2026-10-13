import type { ReportContextLine, ReportStatus } from '@8box/shared';
import type { MemoryAccountStore } from '../accounts/account';

/** A report sent from the chat (`/signaler <name> <reason>`). */
export interface NewReport {
  reporterId: number;
  /** Name typed by the reporter (any case). */
  targetName: string;
  reason: string;
  context: ReportContextLine[];
}

/** A report with the names of the players, as the admin tab lists it. */
export interface ReportRecord {
  id: number;
  at: Date;
  reporterId: number;
  reporterName: string | null;
  targetId: number;
  targetName: string | null;
  reason: string;
  context: ReportContextLine[];
  status: ReportStatus;
  handledByName: string | null;
  handledAt: Date | null;
}

/** How the admin closes a report. */
export type ReportClosing = Exclude<ReportStatus, 'open'>;

/** Where reports are kept: the database, or memory in tests. */
export interface ReportStore {
  /** Records a report; undefined when no player has that name. Gives the target's own spelling. */
  create(report: NewReport): Promise<{ targetName: string } | undefined>;
  /** The open reports first, then the most recent. */
  list(limit: number): Promise<ReportRecord[]>;
  countOpen(): Promise<number>;
  /** Closes an open report; false when there is no such open report. */
  close(reportId: number, status: ReportClosing, adminId: number): Promise<boolean>;
}

/** Reports kept in memory, over the accounts of a MemoryAccountStore: for tests. */
export class MemoryReportStore implements ReportStore {
  readonly reports: (Omit<ReportRecord, 'reporterName' | 'targetName' | 'handledByName'> & {
    handledById: number | null;
  })[] = [];

  constructor(private readonly accounts: MemoryAccountStore) {}

  async create(report: NewReport) {
    const target = await this.accounts.findByName(report.targetName);
    if (!target?.name) {
      return undefined;
    }
    this.reports.push({
      id: this.reports.length + 1,
      at: new Date(),
      reporterId: report.reporterId,
      targetId: target.playerId,
      reason: report.reason,
      context: report.context,
      status: 'open',
      handledById: null,
      handledAt: null,
    });
    return { targetName: target.name };
  }

  async list(limit: number) {
    return this.reports
      .map(({ handledById, ...report }) => ({
        ...report,
        reporterName: this.nameOf(report.reporterId),
        targetName: this.nameOf(report.targetId),
        handledByName: handledById === null ? null : this.nameOf(handledById),
      }))
      .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.id - a.id)
      .slice(0, limit);
  }

  async countOpen() {
    return this.reports.filter((report) => report.status === 'open').length;
  }

  async close(reportId: number, status: ReportClosing, adminId: number) {
    const report = this.reports.find((candidate) => candidate.id === reportId);
    if (report?.status !== 'open') {
      return false;
    }
    Object.assign(report, { status, handledById: adminId, handledAt: new Date() });
    return true;
  }

  private nameOf(playerId: number): string | null {
    return this.accounts.accounts.find((account) => account.playerId === playerId)?.name ?? null;
  }
}
