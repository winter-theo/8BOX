import { eq } from 'drizzle-orm';
import type { Database } from './database';
import { worldState } from './schema';

const SEED_KEY = 'seed';

export async function readSeed(db: Database): Promise<number | undefined> {
  const [row] = await db.select().from(worldState).where(eq(worldState.key, SEED_KEY));
  return typeof row?.value === 'number' ? row.value : undefined;
}

export async function writeSeed(db: Database, seed: number): Promise<void> {
  await db
    .insert(worldState)
    .values({ key: SEED_KEY, value: seed })
    .onConflictDoUpdate({ target: worldState.key, set: { value: seed } });
}
