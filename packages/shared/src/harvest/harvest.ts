import { HARVEST } from '../config/harvest';
import type { ItemDef, LootTable, TileDef } from '../content/schemas';
import type { ItemStack } from '../inventory/inventory';
import type { Rng } from '../util/rng';

/**
 * HP one hit takes from a breakable tile, given the item in hand: the power of a tool of the right
 * kind, otherwise `HARVEST.wrongToolDamage` for another tool, or `HARVEST.handDamage` bare-handed (or
 * with an item that is not a tool).
 */
export function harvestDamage(tile: TileDef, held: ItemDef | undefined): number {
  const tool = held?.tool;
  if (!tool) {
    return HARVEST.handDamage;
  }
  return tool.kind === tile.harvest?.tool ? tool.power : HARVEST.wrongToolDamage;
}

/**
 * Rolls a loot table: each drop happens with its chance and gives `min` to `max` items. Items of the
 * same kind are added up, in the order of the table. Deterministic for a given generator state.
 */
export function rollLoot(table: LootTable, rng: Rng): ItemStack[] {
  const stacks: ItemStack[] = [];
  for (const drop of table.drops) {
    // Always draw the chance, even at 1, so that one drop never shifts the rolls of the next ones.
    if (!rng.chance(drop.chance)) {
      continue;
    }
    const count = rng.int(drop.min, drop.max ?? drop.min);
    const stack = stacks.find((existing) => existing.item === drop.item);
    if (stack) {
      stack.count += count;
    } else {
      stacks.push({ item: drop.item, count });
    }
  }
  return stacks;
}
