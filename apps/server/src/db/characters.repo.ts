import { DEFAULT_SKIN, emptyInventory, equipSlotSchema, isSkin } from '@8box/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { SavedCharacter } from '../persistence/store';
import type { Database } from './database';
import { characters, players } from './schema';

const stackSchema = z.object({ item: z.string(), count: z.number().int().positive() });
const slotsSchema = z.array(stackSchema.nullable());
const equipmentSchema = z.partialRecord(equipSlotSchema, stackSchema);
const spawnPointSchema = z.object({
  layer: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
});

/**
 * The saved characters. A skin the game no longer has becomes the default one; inventory columns of the
 * wrong shape become empty (the inventory module then checks the items against the content), and a
 * spawn point of the wrong shape is forgotten (the world spawn).
 */
export async function readCharacters(db: Database): Promise<SavedCharacter[]> {
  const rows = await db
    .select({
      playerId: characters.playerId,
      layer: characters.layer,
      x: characters.x,
      y: characters.y,
      skin: characters.skin,
      slots: characters.inventory,
      equipment: characters.equipment,
      purse: characters.purse,
      spawnPoint: characters.spawnPoint,
      hp: characters.hp,
      hunger: characters.hunger,
    })
    .from(characters);
  const empty = emptyInventory();
  return rows.map(({ slots, equipment, purse, spawnPoint, hp, hunger, ...row }) => {
    const bed = spawnPointSchema.safeParse(spawnPoint).data;
    return {
      ...row,
      skin: isSkin(row.skin) ? row.skin : DEFAULT_SKIN,
      inventory: {
        slots: slotsSchema.safeParse(slots).data ?? empty.slots,
        equipment: equipmentSchema.safeParse(equipment).data ?? empty.equipment,
        purse,
      },
      ...(bed && { spawnPoint: bed }),
      ...(hp !== null && { health: hp }),
      ...(hunger !== null && { hunger }),
    };
  });
}

/**
 * Saves the position, skin, inventory, spawn point, health and hunger of characters, and when their players were last
 * seen.
 */
export async function writeCharacters(
  db: Database,
  saved: readonly SavedCharacter[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { playerId, layer, x, y, skin, inventory, spawnPoint, health, hunger } of saved) {
      const now = new Date();
      const { slots, equipment, purse } = inventory;
      const values = {
        layer,
        x,
        y,
        skin,
        inventory: slots,
        equipment,
        purse,
        spawnPoint: spawnPoint ?? null,
        hp: health ?? null,
        hunger: hunger ?? null,
      };
      await tx.update(players).set({ lastSeenAt: now }).where(eq(players.id, playerId));
      await tx
        .insert(characters)
        .values({ playerId, ...values, updatedAt: now })
        .onConflictDoUpdate({
          target: characters.playerId,
          set: { ...values, updatedAt: sql`excluded.updated_at` },
        });
    }
  });
}
