import { describe, expect, it } from 'vitest';
import { baseContent } from './base';
import { contentSizes, loadContent } from './load';

describe('base content', () => {
  it('loads without errors', () => {
    const content = loadContent(baseContent);

    expect(contentSizes(content)).toEqual({
      tiles: 10,
      items: 8,
      recipes: 0,
      loot: 3,
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
});
