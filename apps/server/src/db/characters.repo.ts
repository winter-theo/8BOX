import { eq, sql } from 'drizzle-orm';
import type { SavedCharacter } from '../persistence/store';
import type { Database } from './database';
import { characters, players } from './schema';

export async function readCharacters(db: Database): Promise<SavedCharacter[]> {
  return db
    .select({
      playerId: characters.playerId,
      layer: characters.layer,
      x: characters.x,
      y: characters.y,
    })
    .from(characters);
}

/** Saves the position of characters, and when their players were last seen. */
export async function writeCharacters(
  db: Database,
  saved: readonly SavedCharacter[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { playerId, layer, x, y } of saved) {
      const now = new Date();
      await tx.update(players).set({ lastSeenAt: now }).where(eq(players.id, playerId));
      await tx
        .insert(characters)
        .values({ playerId, layer, x, y, updatedAt: now })
        .onConflictDoUpdate({
          target: characters.playerId,
          set: { layer, x, y, updatedAt: sql`excluded.updated_at` },
        });
    }
  });
}
