import { eq } from 'drizzle-orm';
import type { Database } from './database';
import { worldState } from './schema';

const SEED_KEY = 'seed';
/** World clock, in ms of world time since the world was created. */
const TIME_KEY = 'time';

async function readNumber(db: Database, key: string): Promise<number | undefined> {
  const [row] = await db.select().from(worldState).where(eq(worldState.key, key));
  return typeof row?.value === 'number' ? row.value : undefined;
}

async function writeNumber(db: Database, key: string, value: number): Promise<void> {
  await db
    .insert(worldState)
    .values({ key, value })
    .onConflictDoUpdate({ target: worldState.key, set: { value } });
}

export function readSeed(db: Database): Promise<number | undefined> {
  return readNumber(db, SEED_KEY);
}

export function writeSeed(db: Database, seed: number): Promise<void> {
  return writeNumber(db, SEED_KEY, seed);
}

export function readWorldTime(db: Database): Promise<number | undefined> {
  return readNumber(db, TIME_KEY);
}

export function writeWorldTime(db: Database, worldTimeMs: number): Promise<void> {
  return writeNumber(db, TIME_KEY, worldTimeMs);
}
