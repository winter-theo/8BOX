import { eq, sql } from 'drizzle-orm';
import type { Account, AccountStore, NewAccount } from '../accounts/account';
import type { Database } from './database';
import { players } from './schema';

/** PostgreSQL error code of a unique constraint violation. */
const UNIQUE_VIOLATION = '23505';

export type PlayerRow = typeof players.$inferSelect;

export function toAccount(row: PlayerRow): Account {
  return {
    playerId: row.id,
    clerkUserId: row.clerkUserId,
    email: row.email,
    name: row.name,
    status: row.status,
    role: row.role,
    banReason: row.banReason,
    mutedUntil: row.mutedUntil,
  };
}

function required(row: PlayerRow | undefined): Account {
  if (!row) {
    throw new Error('Player not found');
  }
  return toAccount(row);
}

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause;
  return (error as { code?: string }).code === UNIQUE_VIOLATION || cause?.code === UNIQUE_VIOLATION;
}

/** Player accounts in the `players` table. */
export function pgAccountStore(db: Database): AccountStore {
  return {
    async findByClerkId(clerkUserId) {
      const [row] = await db.select().from(players).where(eq(players.clerkUserId, clerkUserId));
      return row && toAccount(row);
    },
    async findByName(name) {
      const [row] = await db
        .select()
        .from(players)
        .where(sql`lower(${players.name}) = lower(${name})`);
      return row && toAccount(row);
    },
    async create(account: NewAccount) {
      const [row] = await db.insert(players).values(account).returning();
      return required(row);
    },
    async update(playerId, changes) {
      const [row] = await db
        .update(players)
        .set(changes)
        .where(eq(players.id, playerId))
        .returning();
      return required(row);
    },
    async setName(playerId, name) {
      try {
        const [row] = await db
          .update(players)
          .set({ name })
          .where(eq(players.id, playerId))
          .returning();
        return required(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          return 'taken';
        }
        throw error;
      }
    },
  };
}
