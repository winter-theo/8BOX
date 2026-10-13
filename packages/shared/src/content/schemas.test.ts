import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../config/inventory';
import { LIGHT } from '../config/light';
import {
  creatureDefSchema,
  itemDefSchema,
  lootTableSchema,
  recipeDefSchema,
  tileDefSchema,
} from './schemas';

const tile = {
  id: 'base:oak_tree',
  slot: 'object',
  sprite: 'obj.oak_tree',
  solid: true,
  tall: true,
  hp: 6,
  harvest: { action: 'cut', tool: 'axe' },
};

describe('tileDefSchema', () => {
  it('accepts a valid tile', () => {
    expect(tileDefSchema.parse(tile)).toEqual(tile);
  });

  it('defaults the light radius', () => {
    expect(tileDefSchema.parse({ ...tile, light: {} }).light).toEqual({
      radiusTiles: LIGHT.defaultRadiusTiles,
    });
  });

  it('rejects unknown keys, bad ids and bad slots', () => {
    expect(tileDefSchema.safeParse({ ...tile, sollid: true }).success).toBe(false);
    expect(tileDefSchema.safeParse({ ...tile, id: 'oak_tree' }).success).toBe(false);
    expect(tileDefSchema.safeParse({ ...tile, slot: 'roof' }).success).toBe(false);
    expect(tileDefSchema.safeParse({ ...tile, hp: -1 }).success).toBe(false);
  });

  it('accepts a harvest action with or without a tool, a pick and a regrowth', () => {
    expect(tileDefSchema.safeParse({ ...tile, harvest: { action: 'uproot' } }).success).toBe(true);
    expect(tileDefSchema.safeParse({ ...tile, harvest: { tool: 'axe' } }).success).toBe(false);
    expect(tileDefSchema.safeParse({ ...tile, harvest: { action: 'chop' } }).success).toBe(false);
    const bush = {
      ...tile,
      harvest: undefined,
      pick: { loot: 'base:berry_bush', becomes: 'base:berry_bush_picked' },
    };
    expect(tileDefSchema.parse(bush).pick).toEqual(bush.pick);
    const picked = { ...tile, regrow: { into: 'base:berry_bush', afterMs: 600_000 } };
    expect(tileDefSchema.parse(picked).regrow).toEqual(picked.regrow);
    expect(
      tileDefSchema.safeParse({ ...tile, regrow: { into: 'base:berry_bush', afterMs: 0 } }).success,
    ).toBe(false);
  });

  it('accepts the wall, door and bed flags', () => {
    const wall = tileDefSchema.parse({ ...tile, wall: true, door: false, bed: true });
    expect([wall.wall, wall.door, wall.bed]).toEqual([true, false, true]);
    expect(tileDefSchema.safeParse({ ...tile, door: 'yes' }).success).toBe(false);
  });

  it('accepts a speed factor between 0 (excluded) and 1', () => {
    expect(tileDefSchema.parse({ ...tile, speedFactor: 0.5 }).speedFactor).toBe(0.5);
    expect(tileDefSchema.safeParse({ ...tile, speedFactor: 0 }).success).toBe(false);
    expect(tileDefSchema.safeParse({ ...tile, speedFactor: 1.5 }).success).toBe(false);
  });
});

describe('itemDefSchema', () => {
  const item = { id: 'base:plank', sprite: 'item.plank' };

  it('defaults stack and tags', () => {
    expect(itemDefSchema.parse(item)).toEqual({
      ...item,
      stack: INVENTORY.defaultStackSize,
      tags: [],
    });
  });

  it('defaults the stack of tools and weapons to the tool stack size', () => {
    const axe = { ...item, tool: { kind: 'axe', power: 2, durability: 60 } };
    const sword = { ...item, weapon: { damage: 3, cooldownMs: 450, durability: 60 } };
    expect(itemDefSchema.parse(axe).stack).toBe(INVENTORY.toolStackSize);
    expect(itemDefSchema.parse(sword).stack).toBe(INVENTORY.toolStackSize);
  });

  it('keeps an explicit stack size', () => {
    expect(itemDefSchema.parse({ ...item, stack: 1_000_000 }).stack).toBe(1_000_000);
  });

  it('accepts food, place and equip fields', () => {
    const parsed = itemDefSchema.parse({
      ...item,
      food: { hunger: 2 },
      place: 'base:wooden_floor',
      equip: { slot: 'bag', extraSlots: 10 },
    });
    expect(parsed.food).toEqual({ hunger: 2 });
    expect(parsed.place).toBe('base:wooden_floor');
    expect(parsed.equip).toEqual({ slot: 'bag', extraSlots: 10 });
  });

  it('rejects an unknown equipment slot and a zero stack', () => {
    expect(itemDefSchema.safeParse({ ...item, equip: { slot: 'feet' } }).success).toBe(false);
    expect(itemDefSchema.safeParse({ ...item, stack: 0 }).success).toBe(false);
  });

  it('rejects a bag that would go beyond the most slots of an inventory', () => {
    const extraSlots = INVENTORY.maxSlots - INVENTORY.mainSlots;
    const bag = (slots: number) => ({ ...item, equip: { slot: 'bag', extraSlots: slots } });
    expect(itemDefSchema.safeParse(bag(extraSlots)).success).toBe(true);
    expect(itemDefSchema.safeParse(bag(extraSlots + 1)).success).toBe(false);
  });
});

describe('recipeDefSchema', () => {
  it('requires at least one input and one output', () => {
    const recipe = {
      id: 'base:plank',
      inputs: [{ item: 'base:oak_log', count: 1 }],
      outputs: [{ item: 'base:plank', count: 4 }],
      timeMs: 0,
    };
    expect(recipeDefSchema.safeParse(recipe).success).toBe(true);
    expect(recipeDefSchema.safeParse({ ...recipe, inputs: [] }).success).toBe(false);
  });
});

describe('lootTableSchema and creatureDefSchema (drafts)', () => {
  it('defaults the count and chance of a drop', () => {
    const table = lootTableSchema.parse({ id: 'base:oak_tree', drops: [{ item: 'base:oak_log' }] });
    expect(table.drops).toEqual([{ item: 'base:oak_log', min: 1, chance: 1 }]);
  });

  it('accepts a range of items, but not one that goes down', () => {
    const drop = { item: 'base:oak_log', min: 2, max: 4, chance: 0.5 };
    expect(lootTableSchema.parse({ id: 'base:oak_tree', drops: [drop] }).drops).toEqual([drop]);
    const reversed = { id: 'base:oak_tree', drops: [{ item: 'base:oak_log', min: 3, max: 2 }] };
    expect(lootTableSchema.safeParse(reversed).success).toBe(false);
    const sure = { id: 'base:oak_tree', drops: [{ item: 'base:oak_log', chance: 1.5 }] };
    expect(lootTableSchema.safeParse(sure).success).toBe(false);
  });

  it('accepts a creature', () => {
    const creature = {
      id: 'base:slime',
      sprite: 'mob.slime',
      hp: 6,
      speedTilesPerSecond: 2,
      damage: 2,
      hostile: true,
    };
    expect(creatureDefSchema.parse(creature)).toEqual(creature);
  });
});
