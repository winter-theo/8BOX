import { distanceToTile, type TilePoint } from '../actions/aim';
import type { RecipeDef, TileDef, TileSlot } from '../content/schemas';
import {
  addItems,
  countInSlots,
  type Inventory,
  type ItemDefs,
  removeItems,
} from '../inventory/inventory';

/** Why a craft cannot be done; shown in the crafting window and when the server refuses. */
export type CraftReason =
  /** No such recipe. */
  | 'unknownRecipe'
  /** The slots do not hold every ingredient. */
  | 'missingItems'
  /** The recipe needs a station (workbench) closer than `CRAFTING.stationReachTiles`. */
  | 'noStation'
  /** No room in the inventory for what the recipe gives. */
  | 'inventoryFull'
  /** Another craft of the player is in progress. */
  | 'busy';

const SLOTS: readonly TileSlot[] = ['ground', 'floor', 'object'];

/** How many times the ingredients in the slots allow the recipe (the equipment worn does not count). */
export function craftableCount(inventory: Inventory, recipe: RecipeDef): number {
  return Math.min(
    ...recipe.inputs.map((input) => Math.floor(countInSlots(inventory, input.item) / input.count)),
  );
}

/**
 * Crafts a recipe once: takes the ingredients out of the slots (exactly), then adds what it gives. Refused
 * when an ingredient is missing, or when what it gives does not fit once the ingredients are taken.
 */
export function craftOnce(
  inventory: Inventory,
  items: ItemDefs,
  recipe: RecipeDef,
): { ok: true; inventory: Inventory } | { ok: false; reason: 'missingItems' | 'inventoryFull' } {
  let next: Inventory | undefined = inventory;
  for (const input of recipe.inputs) {
    next = next && removeItems(next, input.item, input.count);
  }
  if (!next) {
    return { ok: false, reason: 'missingItems' };
  }
  for (const output of recipe.outputs) {
    const added = addItems(next, items, { item: output.item, count: output.count });
    if (added.left > 0) {
      return { ok: false, reason: 'inventoryFull' };
    }
    next = added.inventory;
  }
  return { ok: true, inventory: next };
}

/**
 * Whether a tile providing `station` (in any slot) is within `reachTiles` of the feet: to the nearest
 * point of the tile, like the reach of actions. `tileAt` reads the tiles of the player's layer.
 */
export function stationInReach(
  feet: TilePoint,
  station: string,
  reachTiles: number,
  tileAt: (x: number, y: number, slot: TileSlot) => TileDef | undefined,
): boolean {
  // A tile reaches from x to x + 1: the one left of feet.x - reach may still touch the circle.
  for (let y = Math.floor(feet.y - reachTiles) - 1; y <= Math.floor(feet.y + reachTiles); y++) {
    for (let x = Math.floor(feet.x - reachTiles) - 1; x <= Math.floor(feet.x + reachTiles); x++) {
      if (
        distanceToTile(feet, x, y) <= reachTiles &&
        SLOTS.some((slot) => tileAt(x, y, slot)?.station === station)
      ) {
        return true;
      }
    }
  }
  return false;
}
