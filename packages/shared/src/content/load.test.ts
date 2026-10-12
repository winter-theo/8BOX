import { describe, expect, it } from 'vitest';
import { ContentError, type ContentIssue, loadContent, type RawContent } from './load';

/** Small valid content set; each test breaks one thing. */
function validContent() {
  return {
    tiles: [
      {
        id: 'base:grass',
        slot: 'ground',
        sprite: 'ground.grass',
        solid: false,
        tall: false,
        hp: 0,
      },
      {
        id: 'base:workbench',
        slot: 'object',
        sprite: 'obj.workbench',
        solid: true,
        tall: false,
        hp: 10,
        station: 'base:workbench',
      },
      {
        id: 'base:oak_tree',
        slot: 'object',
        sprite: 'obj.oak_tree',
        solid: true,
        tall: true,
        hp: 6,
        harvest: { tool: 'axe' },
        loot: 'base:oak_tree',
      },
    ] as Record<string, unknown>[],
    items: [
      { id: 'base:oak_log', sprite: 'item.oak_log' },
      { id: 'base:plank', sprite: 'item.plank' },
      { id: 'base:workbench', sprite: 'item.workbench', place: 'base:workbench' },
    ] as Record<string, unknown>[],
    recipes: [
      {
        id: 'base:plank',
        inputs: [{ item: 'base:oak_log', count: 1 }],
        outputs: [{ item: 'base:plank', count: 4 }],
        timeMs: 0,
      },
      {
        id: 'base:planks_at_workbench',
        inputs: [{ item: 'base:oak_log', count: 1 }],
        outputs: [{ item: 'base:plank', count: 5 }],
        station: 'base:workbench',
        timeMs: 1000,
      },
    ] as Record<string, unknown>[],
    loot: [{ id: 'base:oak_tree', drops: [{ item: 'base:oak_log', count: 3 }] }] as Record<
      string,
      unknown
    >[],
    creatures: [] as Record<string, unknown>[],
  } satisfies RawContent;
}

function issuesOf(raw: RawContent): readonly ContentIssue[] {
  try {
    loadContent(raw);
  } catch (error) {
    if (error instanceof ContentError) {
      return error.issues;
    }
    throw error;
  }
  throw new Error('expected loadContent to throw a ContentError');
}

describe('loadContent', () => {
  it('builds registries from valid content', () => {
    const content = loadContent(validContent());

    expect(content.tiles.size).toBe(3);
    expect(content.items.require('base:plank').stack).toBe(99);
    expect(content.recipes.get('base:plank')?.outputs).toEqual([{ item: 'base:plank', count: 4 }]);
    expect(content.loot.has('base:oak_tree')).toBe(true);
    expect(content.creatures.size).toBe(0);
  });

  it('assigns runtime indexes sorted by id, independent of file order', () => {
    const raw = validContent();
    const reversed = { ...raw, items: [...raw.items].reverse() };

    const ids = loadContent(raw).items.all.map((item) => item.id);
    const reversedIds = loadContent(reversed).items.all.map((item) => item.id);

    expect(ids).toEqual(['base:oak_log', 'base:plank', 'base:workbench']);
    expect(reversedIds).toEqual(ids);
    const items = loadContent(raw).items;
    expect(items.indexOf('base:plank')).toBe(1);
    expect(items.byIndex(1)?.id).toBe('base:plank');
    expect(items.indexOf('base:nothing')).toBeUndefined();
    expect(() => items.require('base:nothing')).toThrow('Unknown item "base:nothing"');
  });

  it('reports an invalid field with its file, id and field', () => {
    const raw = validContent();
    raw.tiles[0] = { ...raw.tiles[0], hp: -3 };

    const issues = issuesOf(raw);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: 'tiles', id: 'base:grass', field: 'hp' });
  });

  it('reports an unknown key (typo)', () => {
    const raw = validContent();
    raw.items[0] = { ...raw.items[0], stak: 10 };

    expect(issuesOf(raw)[0]).toMatchObject({ file: 'items', id: 'base:oak_log' });
    expect(issuesOf(raw)[0]?.message).toContain('stak');
  });

  it('reports a duplicate id', () => {
    const raw = validContent();
    raw.items.push({ id: 'base:plank', sprite: 'item.plank_2' });

    expect(issuesOf(raw)).toEqual([
      { file: 'items', id: 'base:plank', field: 'id', message: 'duplicate id' },
    ]);
  });

  it('reports a recipe that refers to an unknown item', () => {
    const raw = validContent();
    raw.recipes[0] = {
      ...raw.recipes[0],
      inputs: [{ item: 'base:missing_log', count: 1 }],
    };

    expect(issuesOf(raw)).toEqual([
      {
        file: 'recipes',
        id: 'base:plank',
        field: 'inputs.0.item',
        message: 'unknown item "base:missing_log"',
      },
    ]);
  });

  it('reports other broken references: placed tile, loot table, station', () => {
    const raw = validContent();
    raw.items[2] = { ...raw.items[2], place: 'base:missing_tile' };
    raw.tiles[2] = { ...raw.tiles[2], loot: 'base:missing_loot' };
    raw.recipes[1] = { ...raw.recipes[1], station: 'base:forge' };

    const fields = issuesOf(raw).map((issue) => `${issue.file}/${issue.id}/${issue.field}`);

    expect(fields).toEqual([
      'tiles/base:oak_tree/loot',
      'items/base:workbench/place',
      'recipes/base:planks_at_workbench/station',
    ]);
  });

  it('reports a file that is not an array', () => {
    expect(issuesOf({ ...validContent(), loot: { id: 'base:oak_tree' } })).toEqual([
      { file: 'loot', message: 'expected a JSON array of entries' },
    ]);
  });

  it('identifies an entry without a valid id by its position', () => {
    const raw = validContent();
    raw.items.push({ sprite: 'item.mystery' });

    expect(issuesOf(raw)[0]).toMatchObject({ file: 'items', id: '#3', field: 'id' });
  });

  it('gives a readable error message', () => {
    const raw = validContent();
    raw.recipes[0] = { ...raw.recipes[0], outputs: [{ item: 'base:nope', count: 1 }] };

    expect(() => loadContent(raw)).toThrow(
      'recipes.json [base:plank] outputs.0.item: unknown item "base:nope"',
    );
  });
});
