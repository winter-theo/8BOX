import { sql } from 'drizzle-orm';
import { CHUNK_FORMAT_VERSION, type SavedChunk } from '../world/chunkSerializer';
import type { Database } from './database';
import { chunks } from './schema';

export async function readChunks(db: Database): Promise<SavedChunk[]> {
  const rows = await db.select().from(chunks);
  return rows.map(({ layer, cx, cy, palette, data, meta }) => ({
    layer,
    cx,
    cy,
    palette,
    data,
    meta,
  }));
}

/** Inserts or replaces chunks, in one statement. */
export async function writeChunks(db: Database, saved: readonly SavedChunk[]): Promise<void> {
  if (saved.length === 0) {
    return;
  }
  await db
    .insert(chunks)
    .values(saved.map((chunk) => ({ ...chunk, version: CHUNK_FORMAT_VERSION })))
    .onConflictDoUpdate({
      target: [chunks.layer, chunks.cx, chunks.cy],
      set: {
        palette: sql`excluded.palette`,
        data: sql`excluded.data`,
        meta: sql`excluded.meta`,
        version: sql`excluded.version`,
        updatedAt: sql`now()`,
      },
    });
}
