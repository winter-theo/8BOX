import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../config/inventory';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import {
  addItems,
  cleanInventory,
  countItem,
  emptyInventory,
  heldStack,
  type Inventory,
  type ItemStack,
  maxDurability,
  moveItems,
  removeItems,
  selectSlot,
  takeGold,
  takeItems,
  wearItem,
} from './inventory';

const { items } = loadContent(baseContent);
const LOG = 'base:oak_log';
const BERRIES = 'base:berries';
const GOLD = 'base:gold';
const BAG = 'base:fiber_bag';
const STACK = 99;
const BAG_SLOTS = 10;

/** An inventory with these stacks in its first slots. */
function withSlots(...stacks: (ItemStack | null)[]): Inventory {
  const inventory = emptyInventory();
  stacks.forEach((stack, i) => {
    inventory.slots[i] = stack;
  });
  return inventory;
}

/** Every item of the inventory, by id: operations never create nor destroy any. */
function totals(inventory: Inventory): Record<string, number> {
  const ids = [LOG, BERRIES, GOLD, BAG];
  return Object.fromEntries(ids.map((id) => [id, countItem(inventory, id)]));
}

describe('addItems', () => {
  it('fills the stacks of the same item, then the empty slots in order', () => {
    const start = withSlots({ item: BERRIES, count: 3 }, { item: LOG, count: 95 });
    const { inventory, left } = addItems(start, items, { item: LOG, count: 10 });
    expect(left).toBe(0);
    expect(inventory.slots[1]).toEqual({ item: LOG, count: STACK });
    expect(inventory.slots[2]).toEqual({ item: LOG, count: 6 });
    expect(start.slots[1]).toEqual({ item: LOG, count: 95 });
  });

  it('splits more than a stack over several slots', () => {
    const { inventory, left } = addItems(emptyInventory(), items, { item: LOG, count: 250 });
    expect(left).toBe(0);
    expect(inventory.slots.slice(0, 3).map((slot) => slot?.count)).toEqual([99, 99, 52]);
  });

  it('gives back what does not fit (overflow)', () => {
    const full = withSlots(
      ...Array.from({ length: INVENTORY.mainSlots }, () => ({ item: BERRIES, count: STACK - 1 })),
    );
    const { inventory, left } = addItems(full, items, { item: BERRIES, count: 25 });
    expect(left).toBe(25 - INVENTORY.mainSlots);
    expect(countItem(inventory, BERRIES)).toBe(INVENTORY.mainSlots * STACK);
  });

  it('puts gold in the purse, up to its limit', () => {
    const { inventory, left } = addItems(emptyInventory(), items, { item: GOLD, count: 40 });
    expect(inventory.purse).toBe(40);
    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
    expect(left).toBe(0);
    const rich = { ...emptyInventory(), purse: 999_990 };
    expect(addItems(rich, items, { item: GOLD, count: 25 })).toMatchObject({
      inventory: { purse: 1_000_000 },
      left: 15,
    });
  });

  it('refuses unknown items and counts that are not positive whole numbers', () => {
    const start = emptyInventory();
    expect(addItems(start, items, { item: 'base:nothing', count: 3 })).toEqual({
      inventory: start,
      left: 3,
    });
    expect(addItems(start, items, { item: LOG, count: 0 }).left).toBe(0);
    expect(addItems(start, items, { item: LOG, count: 1.5 }).inventory).toBe(start);
  });
});

describe('moveItems', () => {
  it('moves a whole stack into an empty slot', () => {
    const moved = moveItems(withSlots({ item: LOG, count: 5 }), items, 0, 4);
    expect(moved?.slots[0]).toBeNull();
    expect(moved?.slots[4]).toEqual({ item: LOG, count: 5 });
  });

  it('splits a stack', () => {
    const moved = moveItems(withSlots({ item: LOG, count: 5 }), items, 0, 1, 2);
    expect(moved?.slots.slice(0, 2)).toEqual([
      { item: LOG, count: 3 },
      { item: LOG, count: 2 },
    ]);
  });

  it('merges onto the same item as far as the stack goes', () => {
    const start = withSlots({ item: LOG, count: 10 }, { item: LOG, count: 95 });
    const moved = moveItems(start, items, 0, 1);
    expect(moved?.slots.slice(0, 2)).toEqual([
      { item: LOG, count: 6 },
      { item: LOG, count: STACK },
    ]);
    expect(moved && moveItems(moved, items, 0, 1)).toBeUndefined();
  });

  it('swaps whole stacks of different items, never a part of one', () => {
    const start = withSlots({ item: LOG, count: 10 }, { item: BERRIES, count: 4 });
    const swapped = moveItems(start, items, 0, 1);
    expect(swapped?.slots.slice(0, 2)).toEqual([
      { item: BERRIES, count: 4 },
      { item: LOG, count: 10 },
    ]);
    expect(moveItems(start, items, 0, 1, 3)).toBeUndefined();
  });

  it('refuses bad places and counts', () => {
    const start = withSlots({ item: LOG, count: 5 });
    for (const [from, to, count] of [
      [0, 0, undefined],
      [1, 2, undefined],
      [0, -1, undefined],
      [0, INVENTORY.mainSlots, undefined],
      [0, 1.5, undefined],
      [0, 1, 6],
      [0, 1, 0],
      [0, 1, 1.5],
    ] as const) {
      expect(moveItems(start, items, from, to, count)).toBeUndefined();
    }
  });

  it('wears a bag, which adds its slots, and only takes it off when they are empty', () => {
    const worn = moveItems(withSlots({ item: BAG, count: 1 }), items, 0, 'bag');
    expect(worn?.equipment.bag).toEqual({ item: BAG, count: 1 });
    expect(worn?.slots).toHaveLength(INVENTORY.mainSlots + BAG_SLOTS);
    if (!worn) {
      return;
    }
    // Not in its own slots.
    expect(moveItems(worn, items, 'bag', INVENTORY.mainSlots + 2)).toBeUndefined();
    const full = addItems(worn, items, { item: LOG, count: STACK * (INVENTORY.mainSlots + 1) });
    expect(full.left).toBe(0);
    expect(full.inventory.slots[INVENTORY.mainSlots]).toEqual({ item: LOG, count: STACK });
    const holding = moveItems(
      addItems(worn, items, { item: LOG, count: 1 }).inventory,
      items,
      0,
      12,
    );
    expect(holding && moveItems(holding, items, 'bag', 3)).toBeUndefined();
    const off = moveItems(worn, items, 'bag', 3);
    expect(off?.slots).toHaveLength(INVENTORY.mainSlots);
    expect(off?.slots[3]).toEqual({ item: BAG, count: 1 });
    expect(off?.equipment.bag).toBeUndefined();
  });

  it('keeps equipment in its own slot, one item at a time', () => {
    const start = withSlots({ item: LOG, count: 5 }, { item: BAG, count: 1 });
    expect(moveItems(start, items, 0, 'bag')).toBeUndefined();
    expect(moveItems(start, items, 1, 'head')).toBeUndefined();
    expect(moveItems(start, items, 0, 'body', 1)).toBeUndefined();
  });

  it('never creates nor destroys items', () => {
    let inventory = withSlots(
      { item: LOG, count: 60 },
      { item: LOG, count: 70 },
      { item: BERRIES, count: 12 },
      { item: BAG, count: 1 },
    );
    inventory = { ...inventory, purse: 30 };
    const before = totals(inventory);
    const refs = [0, 1, 2, 3, 4, 9, 12, 'bag', 'head'] as const;
    for (const from of refs) {
      for (const to of refs) {
        for (const count of [undefined, 1, 7, 99]) {
          inventory = moveItems(inventory, items, from, to, count) ?? inventory;
          expect(totals(inventory)).toEqual(before);
        }
      }
    }
  });
});

describe('takeItems, takeGold, selectSlot', () => {
  it('takes part or all of a stack', () => {
    const start = withSlots({ item: LOG, count: 5 });
    expect(takeItems(start, items, 0, 2)).toEqual({
      inventory: withSlots({ item: LOG, count: 3 }),
      taken: { item: LOG, count: 2 },
    });
    expect(takeItems(start, items, 0)?.taken).toEqual({ item: LOG, count: 5 });
    expect(takeItems(start, items, 0, 6)).toBeUndefined();
    expect(takeItems(start, items, 1)).toBeUndefined();
  });

  it('does not drop a bag that still holds items', () => {
    const worn = moveItems(withSlots({ item: BAG, count: 1 }), items, 0, 'bag');
    if (!worn) {
      throw new Error('bag not worn');
    }
    expect(takeItems(worn, items, 'bag')?.inventory.slots).toHaveLength(INVENTORY.mainSlots);
    const filled = moveItems(
      addItems(worn, items, { item: LOG, count: 1 }).inventory,
      items,
      0,
      15,
    );
    expect(filled && takeItems(filled, items, 'bag')).toBeUndefined();
  });

  it('takes gold from the purse', () => {
    const rich = { ...emptyInventory(), purse: 50 };
    expect(takeGold(rich, 20)?.purse).toBe(30);
    expect(takeGold(rich, 51)).toBeUndefined();
    expect(takeGold(rich, 0)).toBeUndefined();
  });

  it('selects a hotbar slot: the item in hand', () => {
    const start = withSlots(null, null, { item: BERRIES, count: 2 });
    expect(heldStack(start)).toBeNull();
    const selected = selectSlot(start, 2);
    expect(selected && heldStack(selected)).toEqual({ item: BERRIES, count: 2 });
    expect(selectSlot(start, INVENTORY.mainSlots)).toBeUndefined();
    expect(selectSlot(start, -1)).toBeUndefined();
  });
});

describe('cleanInventory', () => {
  it('keeps a valid inventory as it is', () => {
    const saved = { ...withSlots(null, { item: LOG, count: 5 }), purse: 12 };
    expect(cleanInventory(saved, items)).toEqual({ inventory: saved, lost: [] });
  });

  it('moves misplaced items where they fit and reports what is lost', () => {
    const saved: Inventory = {
      slots: [
        { item: 'base:removed', count: 3 },
        { item: GOLD, count: 7 },
        { item: LOG, count: 150 },
        ...Array.from({ length: 12 }, () => null),
        { item: BERRIES, count: 4 },
      ],
      equipment: { head: { item: BAG, count: 1 } },
      purse: 1,
      selected: 4,
    };
    const { inventory, lost } = cleanInventory(saved, items);
    expect(inventory.slots).toHaveLength(INVENTORY.mainSlots);
    expect(inventory.purse).toBe(8);
    expect(inventory.equipment).toEqual({});
    expect(countItem(inventory, LOG)).toBe(150);
    expect(countItem(inventory, BERRIES)).toBe(4);
    expect(countItem(inventory, BAG)).toBe(1);
    expect(lost).toEqual([{ item: 'base:removed', count: 3 }]);
    expect(inventory.selected).toBe(0);
  });
});

describe('removeItems', () => {
  it('takes items of a kind from the last slots first, and never the equipment', () => {
    const inventory = withSlots(
      { item: LOG, count: 5 },
      { item: BERRIES, count: 2 },
      { item: LOG, count: 3 },
    );
    inventory.equipment.bag = { item: BAG, count: 1 };

    const next = removeItems(inventory, LOG, 4);

    expect(next?.slots.slice(0, 3)).toEqual([
      { item: LOG, count: 4 },
      { item: BERRIES, count: 2 },
      null,
    ]);
    expect(next?.equipment.bag).toEqual({ item: BAG, count: 1 });
    expect(removeItems(inventory, LOG, 9)).toBeUndefined();
    expect(removeItems(inventory, BAG, 1)).toBeUndefined();
    expect(removeItems(inventory, LOG, 0)).toBeUndefined();
  });
});

describe('durability', () => {
  const AXE = 'base:wooden_axe';

  it('starts full: absent until the first use', () => {
    expect(maxDurability(items, AXE)).toBe(60);
    expect(maxDurability(items, 'base:wooden_sword')).toBe(60);
    expect(maxDurability(items, LOG)).toBeUndefined();
  });

  it('wears a tool by one use, and breaks it at 0', () => {
    let inventory = withSlots({ item: AXE, count: 1 });
    for (let use = 1; use < 60; use++) {
      const worn = wearItem(inventory, items, 0);
      expect(worn?.broken).toBe(false);
      inventory = worn?.inventory ?? inventory;
    }
    expect(inventory.slots[0]).toEqual({ item: AXE, count: 1, durability: 1 });

    const last = wearItem(inventory, items, 0);

    expect(last?.broken).toBe(true);
    expect(last?.inventory.slots[0]).toBeNull();
  });

  it('only wears tools and weapons', () => {
    expect(wearItem(withSlots({ item: LOG, count: 3 }), items, 0)).toBeUndefined();
    expect(wearItem(emptyInventory(), items, 0)).toBeUndefined();
  });

  it('keeps the uses left when a tool is moved, dropped or picked up again', () => {
    const axe = { item: AXE, count: 1, durability: 12 };
    const inventory = withSlots(axe, { item: AXE, count: 1 });

    expect(moveItems(inventory, items, 0, 5)?.slots[5]).toEqual(axe);
    // Two axes worn differently swap.
    expect(moveItems(inventory, items, 0, 1)?.slots.slice(0, 2)).toEqual([
      { item: AXE, count: 1 },
      axe,
    ]);
    expect(takeItems(inventory, items, 0)?.taken).toEqual(axe);
    expect(addItems(emptyInventory(), items, axe).inventory.slots[0]).toEqual(axe);
  });

  it('only merges stacks worn the same', () => {
    const added = addItems(withSlots({ item: LOG, count: 1, durability: 3 }), items, {
      item: LOG,
      count: 2,
    });

    expect(added.inventory.slots.slice(0, 2)).toEqual([
      { item: LOG, count: 1, durability: 3 },
      { item: LOG, count: 2 },
    ]);
  });

  it('cleans the uses left of a saved inventory', () => {
    const { inventory } = cleanInventory(
      {
        slots: [
          { item: AXE, count: 1, durability: 30 },
          { item: AXE, count: 1, durability: 500 },
          { item: AXE, count: 1, durability: 0 },
          { item: LOG, count: 4, durability: 2 },
        ],
        equipment: {},
        purse: 0,
      },
      items,
    );

    expect(inventory.slots.slice(0, 4)).toEqual([
      { item: AXE, count: 1, durability: 30 },
      { item: AXE, count: 1 },
      { item: AXE, count: 1 },
      { item: LOG, count: 4 },
    ]);
  });
});
