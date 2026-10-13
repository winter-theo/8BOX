import { describe, expect, it } from 'vitest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import type { TileDef, TileSlot } from '../content/schemas';
import { countItem, emptyInventory, type Inventory, type ItemStack } from '../inventory/inventory';
import { craftableCount, craftOnce, stationInReach } from './crafting';

const content = loadContent(baseContent);
const { items } = content;
const recipe = (id: string) => content.recipes.require(id);

function withSlots(...stacks: (ItemStack | null)[]): Inventory {
  const inventory = emptyInventory();
  stacks.forEach((stack, i) => {
    inventory.slots[i] = stack;
  });
  return inventory;
}

describe('craftOnce', () => {
  it('takes exactly the ingredients and gives what the recipe makes', () => {
    const inventory = withSlots({ item: 'base:oak_log', count: 3 });

    const result = craftOnce(inventory, items, recipe('base:plank'));

    expect(result.ok).toBe(true);
    const next = result.ok ? result.inventory : inventory;
    expect(countItem(next, 'base:oak_log')).toBe(2);
    expect(countItem(next, 'base:plank')).toBe(4);
    // The inventory given is never modified.
    expect(countItem(inventory, 'base:oak_log')).toBe(3);
  });

  it('takes several ingredients, from the last slots first', () => {
    const inventory = withSlots(
      { item: 'base:plank', count: 2 },
      { item: 'base:stick', count: 5 },
      { item: 'base:plank', count: 2 },
    );

    const result = craftOnce(inventory, items, recipe('base:wooden_axe'));

    expect(result.ok && result.inventory.slots.slice(0, 4)).toEqual([
      { item: 'base:plank', count: 1 },
      { item: 'base:stick', count: 3 },
      { item: 'base:wooden_axe', count: 1 },
      null,
    ]);
  });

  it('refuses when an ingredient is missing, and changes nothing', () => {
    const inventory = withSlots({ item: 'base:plank', count: 3 }, { item: 'base:stick', count: 1 });

    expect(craftOnce(inventory, items, recipe('base:wooden_axe'))).toEqual({
      ok: false,
      reason: 'missingItems',
    });
  });

  it('does not count the equipment worn', () => {
    const inventory = withSlots({ item: 'base:fiber', count: 19 });
    inventory.equipment.bag = { item: 'base:fiber_bag', count: 1 };

    expect(craftableCount(inventory, recipe('base:fiber_bag'))).toBe(0);
    expect(craftOnce(inventory, items, recipe('base:fiber_bag')).ok).toBe(false);
  });

  it('crafts into the room the ingredients leave', () => {
    // Full: 9 stacks of berries and 1 log, which turns into 4 planks in the same slot.
    const inventory = withSlots(
      ...Array.from({ length: 9 }, () => ({ item: 'base:berries', count: 99 })),
      { item: 'base:oak_log', count: 1 },
    );

    const result = craftOnce(inventory, items, recipe('base:plank'));

    expect(result.ok && result.inventory.slots[9]).toEqual({ item: 'base:plank', count: 4 });
  });

  it('refuses when what it gives does not fit', () => {
    const inventory = withSlots(
      ...Array.from({ length: 9 }, () => ({ item: 'base:berries', count: 99 })),
      { item: 'base:oak_log', count: 2 },
    );

    expect(craftOnce(inventory, items, recipe('base:plank'))).toEqual({
      ok: false,
      reason: 'inventoryFull',
    });
  });

  it('counts how many times the ingredients allow a recipe', () => {
    const inventory = withSlots({ item: 'base:plank', count: 7 }, { item: 'base:stick', count: 9 });

    expect(craftableCount(inventory, recipe('base:wooden_axe'))).toBe(2);
    expect(craftableCount(inventory, recipe('base:workbench'))).toBe(0);
    expect(craftableCount(emptyInventory(), recipe('base:plank'))).toBe(0);
  });
});

describe('stationInReach', () => {
  const workbench = content.tiles.require('base:workbench');
  /** A world with a single workbench at (10, 10). */
  const tileAt = (x: number, y: number, slot: TileSlot): TileDef | undefined =>
    x === 10 && y === 10 && slot === 'object' ? workbench : undefined;

  it('finds a station up to 3 tiles away from the feet, to the nearest point of its tile', () => {
    expect(stationInReach({ x: 10.5, y: 11.5 }, 'base:workbench', 3, tileAt)).toBe(true);
    // 3 tiles to the right of the tile's edge (x = 11).
    expect(stationInReach({ x: 14, y: 10.5 }, 'base:workbench', 3, tileAt)).toBe(true);
    expect(stationInReach({ x: 14.1, y: 10.5 }, 'base:workbench', 3, tileAt)).toBe(false);
    expect(stationInReach({ x: 13.5, y: 13.5 }, 'base:workbench', 3, tileAt)).toBe(false);
  });

  it('only finds the station asked for', () => {
    expect(stationInReach({ x: 10.5, y: 11.5 }, 'base:furnace', 3, tileAt)).toBe(false);
  });
});
