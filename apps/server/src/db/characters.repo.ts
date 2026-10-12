import { eq, sql } from 'drizzle-orm';
import type { SavedCharacter } from '../persistence/store';
import type { Database } from './database';
import { characters, players } from './schema';

export async function readCharacters(db: Database): Promise<SavedCharacter[]> {
  return db
    .select({ name: players.name, layer: characters.layer, x: characters.x, y: characters.y })
    .from(characters)
    .innerJoin(players, eq(players.id, characters.playerId));
}

/**
 * Saves the position of characters. Until Clerk (step 11), a player is known by name: the first save
 * of a name creates the player (approved, as dev players are).
 */
export async function writeCharacters(
  db: Database,
  saved: readonly SavedCharacter[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { name, layer, x, y } of saved) {
      const now = new Date();
      let [player] = await tx
        .select({ id: players.id })
        .from(players)
        .where(sql`lower(${players.name}) = lower(${name})`);
      if (!player) {
        [player] = await tx
          .insert(players)
          .values({ name, status: 'approved' })
          .returning({ id: players.id });
      }
      if (!player) {
        throw new Error(`Could not create the player "${name}"`);
      }
      await tx.update(players).set({ lastSeenAt: now }).where(eq(players.id, player.id));
      await tx
        .insert(characters)
        .values({ playerId: player.id, layer, x, y, updatedAt: now })
        .onConflictDoUpdate({
          target: characters.playerId,
          set: { layer, x, y, updatedAt: now },
        });
    }
  });
}
