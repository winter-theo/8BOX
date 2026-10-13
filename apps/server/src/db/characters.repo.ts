import { DEFAULT_SKIN, isSkin } from '@8box/shared';
import { eq, sql } from 'drizzle-orm';
import type { SavedCharacter } from '../persistence/store';
import type { Database } from './database';
import { characters, players } from './schema';

/** The saved characters; a skin the game no longer has becomes the default one. */
export async function readCharacters(db: Database): Promise<SavedCharacter[]> {
  const rows = await db
    .select({
      playerId: characters.playerId,
      layer: characters.layer,
      x: characters.x,
      y: characters.y,
      skin: characters.skin,
    })
    .from(characters);
  return rows.map((row) => ({ ...row, skin: isSkin(row.skin) ? row.skin : DEFAULT_SKIN }));
}

/** Saves the position and skin of characters, and when their players were last seen. */
export async function writeCharacters(
  db: Database,
  saved: readonly SavedCharacter[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { playerId, layer, x, y, skin } of saved) {
      const now = new Date();
      await tx.update(players).set({ lastSeenAt: now }).where(eq(players.id, playerId));
      await tx
        .insert(characters)
        .values({ playerId, layer, x, y, skin, updatedAt: now })
        .onConflictDoUpdate({
          target: characters.playerId,
          set: { layer, x, y, skin, updatedAt: sql`excluded.updated_at` },
        });
    }
  });
}
