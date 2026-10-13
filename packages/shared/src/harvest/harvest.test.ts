import { describe, expect, it } from 'vitest';
import { HARVEST } from '../config/harvest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { type ItemDef, itemDefSchema, type LootTable } from '../content/schemas';
import { createRng } from '../util/rng';
import { harvestDamage, rollLoot } from './harvest';

const content = loadContent(baseContent);
const oak = content.tiles.require('base:oak_tree');
const grass = content.tiles.require('base:tall_grass');

function tool(kind: 'axe' | 'pickaxe', power: number): ItemDef {
  return itemDefSchema.parse({
    id: `test:${kind}`,
    sprite: `item.${kind}`,
    tool: { kind, power, durability: 60 },
  });
}

describe('harvestDamage', () => {
  it('takes 1 HP bare-handed or with an item that is not a tool', () => {
    expect(harvestDamage(oak, undefined)).toBe(HARVEST.handDamage);
    expect(harvestDamage(oak, content.items.require('base:oak_log'))).toBe(1);
  });

  it('takes the power of the right tool, and 1 with another tool', () => {
    expect(harvestDamage(oak, tool('axe', 2))).toBe(2);
    expect(harvestDamage(oak, tool('axe', 5))).toBe(5);
    expect(harvestDamage(oak, tool('pickaxe', 2))).toBe(HARVEST.wrongToolDamage);
    // Tall grass asks for no tool: any tool is a wrong one, bare hands are as good.
    expect(harvestDamage(grass, tool('axe', 2))).toBe(1);
  });
});

describe('rollLoot', () => {
  const oakLoot = content.loot.require('base:oak_tree');

  it('is the same for the same seed', () => {
    const first = Array.from({ length: 20 }, (_, seed) => rollLoot(oakLoot, createRng(seed)));
    const again = Array.from({ length: 20 }, (_, seed) => rollLoot(oakLoot, createRng(seed)));
    expect(again).toEqual(first);
  });

  it('gives an oak 2 to 4 logs, and an apple about one time in five', () => {
    const rng = createRng(42);
    const counts = new Set<number>();
    let apples = 0;
    const rolls = 2000;
    for (let i = 0; i < rolls; i++) {
      const loot = rollLoot(oakLoot, rng);
      counts.add(loot.find((stack) => stack.item === 'base:oak_log')?.count ?? 0);
      apples += loot.find((stack) => stack.item === 'base:apple')?.count ?? 0;
    }
    expect([...counts].sort()).toEqual([2, 3, 4]);
    expect(apples / rolls).toBeGreaterThan(0.17);
    expect(apples / rolls).toBeLessThan(0.23);
  });

  it('adds up drops of the same item and skips the ones that do not happen', () => {
    const table: LootTable = {
      id: 'test:table',
      drops: [
        { item: 'base:stick', min: 1, chance: 1 },
        { item: 'base:fiber', min: 1, chance: 0 },
        { item: 'base:stick', min: 2, max: 2, chance: 1 },
      ],
    };
    expect(rollLoot(table, createRng(1))).toEqual([{ item: 'base:stick', count: 3 }]);
  });
});
