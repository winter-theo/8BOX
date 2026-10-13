import { describe, expect, it } from 'vitest';
import { baseContent } from './base';
import { contentSizes, loadContent } from './load';

describe('base content', () => {
  it('loads without errors', () => {
    const content = loadContent(baseContent);

    expect(contentSizes(content)).toEqual({
      tiles: 16,
      items: 17,
      recipes: 12,
      loot: 9,
      creatures: 0,
    });
  });

  it('contains the starting terrain, plants and items', () => {
    const content = loadContent(baseContent);

    for (const id of ['base:grass', 'base:deep_water', 'base:oak_tree', 'base:berry_bush']) {
      expect(content.tiles.has(id), id).toBe(true);
    }
    expect(content.items.require('base:berries').food).toEqual({ hunger: 2 });
    expect(content.items.require('base:apple').food).toEqual({ hunger: 4 });
    expect(content.items.require('base:gold').stack).toBe(1_000_000);
  });

  it('gives logs and sometimes an apple for an oak, and berries that grow back in 10 minutes', () => {
    const content = loadContent(baseContent);

    expect(content.tiles.require('base:oak_tree').harvest).toEqual({ action: 'cut', tool: 'axe' });
    expect(content.loot.require('base:oak_tree').drops).toEqual([
      { item: 'base:oak_log', min: 2, max: 4, chance: 1 },
      { item: 'base:apple', min: 1, chance: 0.2 },
    ]);
    expect(content.tiles.require('base:tall_grass').harvest).toEqual({ action: 'uproot' });
    expect(content.tiles.require('base:berry_bush').pick?.becomes).toBe('base:berry_bush_picked');
    expect(content.tiles.require('base:berry_bush_picked').regrow).toEqual({
      into: 'base:berry_bush',
      afterMs: 10 * 60 * 1000,
    });
  });

  it('has the recipes of the starting items, by hand or at the workbench', () => {
    const content = loadContent(baseContent);
    const recipe = (id: string) => content.recipes.require(id);

    expect(recipe('base:plank')).toMatchObject({
      inputs: [{ item: 'base:oak_log', count: 1 }],
      outputs: [{ item: 'base:plank', count: 4 }],
    });
    expect(recipe('base:workbench').station).toBeUndefined();
    expect(recipe('base:wooden_axe')).toMatchObject({
      inputs: [
        { item: 'base:plank', count: 3 },
        { item: 'base:stick', count: 2 },
      ],
      station: 'base:workbench',
    });
    for (const { id, timeMs } of content.recipes.all) {
      expect(timeMs, id).toBeGreaterThanOrEqual(500);
      expect(timeMs, id).toBeLessThanOrEqual(2000);
    }
    expect(content.tiles.require('base:workbench').station).toBe('base:workbench');
  });

  it('has wooden tools that wear, and items that are placed and give themselves back', () => {
    const content = loadContent(baseContent);

    expect(content.items.require('base:wooden_axe').tool).toEqual({
      kind: 'axe',
      power: 2,
      durability: 60,
    });
    expect(content.items.require('base:wooden_sword').weapon?.durability).toBe(60);
    for (const item of content.items.all.filter((def) => def.place)) {
      const tile = content.tiles.require(item.place ?? '');
      expect(tile.loot, item.id).toBe(item.id);
      expect(tile.harvest?.action, item.id).toBe('break');
    }
    expect(content.tiles.require('base:wooden_wall').hp).toBe(20);
    expect(content.tiles.require('base:wooden_floor').slot).toBe('floor');
  });
});
