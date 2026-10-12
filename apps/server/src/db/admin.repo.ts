import { count, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AdminStore, PlayerRecord } from '../admin/store';
import { type PlayerRow, toAccount } from './accounts.repo';
import type { Database } from './database';
import { adminAudit, players } from './schema';

function toRecord(row: PlayerRow): PlayerRecord {
  return { ...toAccount(row), createdAt: row.createdAt, lastSeenAt: row.lastSeenAt };
}

/** The admin tab's players (`players`) and actions (`admin_audit`). */
export function pgAdminStore(db: Database): AdminStore {
  return {
    async listPlayers() {
      const rows = await db.select().from(players).orderBy(desc(players.createdAt));
      return rows.map(toRecord);
    },
    async findPlayer(playerId) {
      const [row] = await db.select().from(players).where(eq(players.id, playerId));
      return row && toRecord(row);
    },
    async countPending() {
      const [row] = await db
        .select({ pending: count() })
        .from(players)
        .where(eq(players.status, 'pending'));
      return row?.pending ?? 0;
    },
    async changeStatus(playerId, change, audit) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(players)
          .set(change)
          .where(eq(players.id, playerId))
          .returning();
        if (!row) {
          throw new Error('Player not found');
        }
        await tx.insert(adminAudit).values(audit);
        return toRecord(row);
      });
    },
    async record(audit) {
      await db.insert(adminAudit).values(audit);
    },
    async listAudit(limit) {
      const admin = alias(players, 'admin');
      const target = alias(players, 'target');
      return db
        .select({
          id: adminAudit.id,
          at: adminAudit.createdAt,
          action: adminAudit.action,
          adminId: adminAudit.adminId,
          adminName: admin.name,
          targetId: adminAudit.targetId,
          targetName: target.name,
          reason: adminAudit.reason,
        })
        .from(adminAudit)
        .innerJoin(admin, eq(admin.id, adminAudit.adminId))
        .innerJoin(target, eq(target.id, adminAudit.targetId))
        .orderBy(desc(adminAudit.createdAt), desc(adminAudit.id))
        .limit(limit);
    },
  };
}
