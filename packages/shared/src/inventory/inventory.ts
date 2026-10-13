import { INVENTORY } from '../config/inventory';
import type { EquipSlot, ItemDef } from '../content/schemas';

/** Items of one kind in one slot. */
export interface ItemStack {
  /** Item id, e.g. `base:oak_log`. */
  item: string;
  count: number;
}

/** An inventory slot: a stack, or null when empty. */
export type Slot = ItemStack | null;

/** Where an item sits: a slot index (the hotbar first, then the bag), or an equipment slot. */
export type SlotRef = number | EquipSlot;

/** What a character carries. Operations never modify it: they return a new one. */
export interface Inventory {
  /** The hotbar (`INVENTORY.mainSlots`), then the slots of the bag: as many as `capacityOf`. */
  slots: Slot[];
  /** What the character wears: one item per equipment slot. */
  equipment: Partial<Record<EquipSlot, ItemStack>>;
  /** Gold in the purse, in coins (gold never goes in `slots`). */
  purse: number;
  /** Active hotbar slot: the item in hand. */
  selected: number;
}

/** What is saved of an inventory: the item in hand is not. */
export type StoredInventory = Omit<Inventory, 'selected'>;

/** The item definitions the operations need (the content registry). */
export interface ItemDefs {
  get(id: string): ItemDef | undefined;
}

export function emptyInventory(): Inventory {
  return {
    slots: Array.from({ length: INVENTORY.mainSlots }, () => null),
    equipment: {},
    purse: 0,
    selected: 0,
  };
}

/** Most items of this kind in one slot; 0 for an unknown item. */
export function stackLimit(items: ItemDefs, item: string): number {
  return items.get(item)?.stack ?? 0;
}

/** Most gold the purse holds, in coins. */
export function purseLimit(items: ItemDefs): number {
  return stackLimit(items, INVENTORY.currencyItem);
}

export function isEquipSlot(ref: unknown): ref is EquipSlot {
  return (INVENTORY.equipmentSlots as readonly unknown[]).includes(ref);
}

/** Slots of an inventory with this equipment: the hotbar, plus those of the bag. */
export function capacityOf(items: ItemDefs, equipment: Inventory['equipment']): number {
  const bag = equipment.bag;
  const extra = bag ? (items.get(bag.item)?.equip?.extraSlots ?? 0) : 0;
  return Math.min(INVENTORY.mainSlots + extra, INVENTORY.maxSlots);
}

/** The item in hand, if any. */
export function heldStack(inventory: Inventory): ItemStack | null {
  return inventory.slots[inventory.selected] ?? null;
}

/** How many of this item the inventory holds: slots, equipment and purse. */
export function countItem(inventory: Inventory, item: string): number {
  const stacks = [...inventory.slots, ...Object.values(inventory.equipment)];
  const inSlots = stacks.reduce((sum, stack) => sum + (stack?.item === item ? stack.count : 0), 0);
  return inSlots + (item === INVENTORY.currencyItem ? inventory.purse : 0);
}

function clone(inventory: Inventory): Inventory {
  return { ...inventory, slots: [...inventory.slots], equipment: { ...inventory.equipment } };
}

function isValidRef(inventory: Inventory, ref: SlotRef): boolean {
  return typeof ref === 'number'
    ? Number.isInteger(ref) && ref >= 0 && ref < inventory.slots.length
    : isEquipSlot(ref);
}

function stackAt(inventory: Inventory, ref: SlotRef): Slot {
  return (typeof ref === 'number' ? inventory.slots[ref] : inventory.equipment[ref]) ?? null;
}

function setStack(inventory: Inventory, ref: SlotRef, stack: Slot): void {
  if (typeof ref === 'number') {
    inventory.slots[ref] = stack;
  } else if (stack) {
    inventory.equipment[ref] = stack;
  } else {
    delete inventory.equipment[ref];
  }
}

/** Most items of this kind a place holds: a stack in a slot, one item in an equipment slot. */
function placeLimit(items: ItemDefs, ref: SlotRef, item: string): number {
  return typeof ref === 'number' ? stackLimit(items, item) : Math.min(1, stackLimit(items, item));
}

/** Whether the stack can sit there: gold only in the purse, equipment in its own slot. */
function accepts(items: ItemDefs, ref: SlotRef, stack: ItemStack): boolean {
  const fits = stack.count <= placeLimit(items, ref, stack.item);
  if (typeof ref === 'number') {
    return fits && stack.item !== INVENTORY.currencyItem;
  }
  return fits && items.get(stack.item)?.equip?.slot === ref;
}

function minus(stack: ItemStack, count: number): Slot {
  return stack.count > count ? { ...stack, count: stack.count - count } : null;
}

/**
 * Resizes the slots to the capacity of the bag worn; undefined when that would lose items (a bag taken
 * off while full, or put in its own slots).
 */
function fitCapacity(inventory: Inventory, items: ItemDefs): Inventory | undefined {
  const capacity = capacityOf(items, inventory.equipment);
  if (inventory.slots.slice(capacity).some((stack) => stack !== null)) {
    return undefined;
  }
  inventory.slots = Array.from({ length: capacity }, (_, i) => inventory.slots[i] ?? null);
  return inventory;
}

/**
 * Adds items: gold to the purse, other items to the stacks of the same item first, then to the empty
 * slots in order. `left` is what did not fit (all of it for an unknown item).
 */
export function addItems(
  inventory: Inventory,
  items: ItemDefs,
  stack: ItemStack,
): { inventory: Inventory; left: number } {
  const limit = stackLimit(items, stack.item);
  if (limit === 0 || !Number.isInteger(stack.count) || stack.count <= 0) {
    return { inventory, left: Math.max(0, stack.count) };
  }
  const next = clone(inventory);
  let left = stack.count;
  if (stack.item === INVENTORY.currencyItem) {
    const added = Math.min(left, purseLimit(items) - next.purse);
    next.purse += added;
    return { inventory: next, left: left - added };
  }
  next.slots.forEach((slot, i) => {
    if (left > 0 && slot?.item === stack.item && slot.count < limit) {
      const added = Math.min(left, limit - slot.count);
      next.slots[i] = { ...slot, count: slot.count + added };
      left -= added;
    }
  });
  next.slots.forEach((slot, i) => {
    if (left > 0 && slot === null) {
      const added = Math.min(left, limit);
      next.slots[i] = { item: stack.item, count: added };
      left -= added;
    }
  });
  return { inventory: next, left };
}

/**
 * Moves `count` items (default: the whole stack) from one place to another: into an empty place, onto
 * a stack of the same item (as many as fit), or swaps two whole stacks of different items. An
 * equipment slot takes one item. Undefined when nothing can move.
 */
export function moveItems(
  inventory: Inventory,
  items: ItemDefs,
  from: SlotRef,
  to: SlotRef,
  count?: number,
): Inventory | undefined {
  if (from === to || !isValidRef(inventory, from) || !isValidRef(inventory, to)) {
    return undefined;
  }
  const source = stackAt(inventory, from);
  const moving = count ?? source?.count ?? 0;
  if (!source || !Number.isInteger(moving) || moving <= 0 || moving > source.count) {
    return undefined;
  }
  const target = stackAt(inventory, to);
  const next = clone(inventory);
  if (target === null || target.item === source.item) {
    const room = placeLimit(items, to, source.item) - (target?.count ?? 0);
    const moved = Math.min(moving, room);
    const result = { item: source.item, count: (target?.count ?? 0) + moved };
    if (moved <= 0 || !accepts(items, to, result)) {
      return undefined;
    }
    setStack(next, to, result);
    setStack(next, from, minus(source, moved));
  } else {
    if (moving !== source.count || !accepts(items, to, source) || !accepts(items, from, target)) {
      return undefined;
    }
    setStack(next, to, source);
    setStack(next, from, target);
  }
  return fitCapacity(next, items);
}

/** Takes `count` items (default: the whole stack) out of a place: to drop them. */
export function takeItems(
  inventory: Inventory,
  items: ItemDefs,
  from: SlotRef,
  count?: number,
): { inventory: Inventory; taken: ItemStack } | undefined {
  const source = isValidRef(inventory, from) ? stackAt(inventory, from) : null;
  const taking = count ?? source?.count ?? 0;
  if (!source || !Number.isInteger(taking) || taking <= 0 || taking > source.count) {
    return undefined;
  }
  const next = clone(inventory);
  setStack(next, from, minus(source, taking));
  const fitted = fitCapacity(next, items);
  return fitted && { inventory: fitted, taken: { item: source.item, count: taking } };
}

/** Takes gold out of the purse. */
export function takeGold(inventory: Inventory, count: number): Inventory | undefined {
  if (!Number.isInteger(count) || count <= 0 || count > inventory.purse) {
    return undefined;
  }
  return { ...inventory, purse: inventory.purse - count };
}

/** Picks the hotbar slot whose item is in hand. */
export function selectSlot(inventory: Inventory, slot: number): Inventory | undefined {
  if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY.mainSlots) {
    return undefined;
  }
  return { ...inventory, selected: slot };
}

/**
 * An inventory that follows the rules, from a saved one that may not (content changed since). Valid
 * stacks keep their place; the others (unknown item, too many, gold in a slot, equipment in the wrong
 * slot, beyond the capacity) are added again where they fit. Returns what could not be kept.
 */
export function cleanInventory(
  saved: StoredInventory,
  items: ItemDefs,
): { inventory: Inventory; lost: ItemStack[] } {
  const loose: ItemStack[] = [];
  const equipment: Inventory['equipment'] = {};
  for (const slot of INVENTORY.equipmentSlots) {
    const stack = saved.equipment[slot];
    if (stack && accepts(items, slot, stack)) {
      equipment[slot] = stack;
    } else if (stack) {
      loose.push(stack);
    }
  }
  const capacity = capacityOf(items, equipment);
  const slots = saved.slots.map((stack, i): Slot => {
    if (stack && i < capacity && stack.count > 0 && accepts(items, i, stack)) {
      return stack;
    }
    if (stack) {
      loose.push(stack);
    }
    return null;
  });
  let inventory: Inventory = {
    slots: Array.from({ length: capacity }, (_, i) => slots[i] ?? null),
    equipment,
    purse: 0,
    selected: 0,
  };
  const lost: ItemStack[] = [];
  for (const stack of [{ item: INVENTORY.currencyItem, count: saved.purse }, ...loose]) {
    const added = addItems(inventory, items, stack);
    inventory = added.inventory;
    if (added.left > 0) {
      lost.push({ item: stack.item, count: added.left });
    }
  }
  return { inventory, lost };
}
