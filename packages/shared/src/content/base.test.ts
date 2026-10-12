import { describe, expect, it } from 'vitest';
import { baseContent } from './base';
import { contentSizes, loadContent } from './load';

describe('base content', () => {
  it('loads without errors', () => {
    const content = loadContent(baseContent);

    expect(contentSizes(content)).toEqual({
      tiles: 9,
      items: 7,
      recipes: 0,
      loot: 0,
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
});
