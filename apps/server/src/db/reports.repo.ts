import { and, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ReportStore } from '../reports/store';
import type { Database } from './database';
import { players, reports } from './schema';

/** Reports of players (`reports`). */
export function pgReportStore(db: Database): ReportStore {
  return {
    async create(report) {
      const [target] = await db
        .select({ id: players.id, name: players.name })
        .from(players)
        .where(sql`lower(${players.name}) = lower(${report.targetName})`);
      if (!target?.name) {
        return undefined;
      }
      await db.insert(reports).values({
        reporterId: report.reporterId,
        targetId: target.id,
        reason: report.reason,
        context: report.context,
      });
      return { targetName: target.name };
    },
    async list(limit) {
      const reporter = alias(players, 'reporter');
      const target = alias(players, 'target');
      const handler = alias(players, 'handler');
      return db
        .select({
          id: reports.id,
          at: reports.createdAt,
          reporterId: reports.reporterId,
          reporterName: reporter.name,
          targetId: reports.targetId,
          targetName: target.name,
          reason: reports.reason,
          context: reports.context,
          status: reports.status,
          handledByName: handler.name,
          handledAt: reports.handledAt,
        })
        .from(reports)
        .innerJoin(reporter, eq(reporter.id, reports.reporterId))
        .innerJoin(target, eq(target.id, reports.targetId))
        .leftJoin(handler, eq(handler.id, reports.handledBy))
        .orderBy(sql`${reports.status} = 'open' desc`, desc(reports.createdAt), desc(reports.id))
        .limit(limit);
    },
    async countOpen() {
      const [row] = await db
        .select({ open: count() })
        .from(reports)
        .where(eq(reports.status, 'open'));
      return row?.open ?? 0;
    },
    async close(reportId, status, adminId) {
      const closed = await db
        .update(reports)
        .set({ status, handledBy: adminId, handledAt: new Date() })
        .where(and(eq(reports.id, reportId), eq(reports.status, 'open')))
        .returning({ id: reports.id });
      return closed.length > 0;
    },
  };
}
