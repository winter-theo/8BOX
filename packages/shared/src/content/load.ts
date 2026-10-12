import type { z } from 'zod';
import { Registry } from './registry';
import {
  type CreatureDef,
  creatureDefSchema,
  type ItemDef,
  itemDefSchema,
  type LootTable,
  lootTableSchema,
  type RecipeDef,
  recipeDefSchema,
  type TileDef,
  tileDefSchema,
} from './schemas';

/** Content files, each one a JSON array of entries (`<name>.json`). */
export const CONTENT_FILES = ['tiles', 'items', 'recipes', 'loot', 'creatures'] as const;
export type ContentFile = (typeof CONTENT_FILES)[number];

/** Parsed JSON of every content file, not validated yet. */
export type RawContent = Record<ContentFile, unknown>;

export interface Content {
  tiles: Registry<TileDef>;
  items: Registry<ItemDef>;
  recipes: Registry<RecipeDef>;
  loot: Registry<LootTable>;
  creatures: Registry<CreatureDef>;
}

export interface ContentIssue {
  file: ContentFile;
  /** Id of the faulty entry, or `#<position>` when it has no valid id. */
  id?: string;
  /** Path of the faulty field, e.g. `inputs.0.item`. */
  field?: string;
  message: string;
}

export function formatContentIssue(issue: ContentIssue): string {
  const where = [
    `${issue.file}.json`,
    issue.id === undefined ? '' : ` [${issue.id}]`,
    issue.field === undefined ? '' : ` ${issue.field}`,
  ].join('');
  return `${where}: ${issue.message}`;
}

export class ContentError extends Error {
  readonly issues: readonly ContentIssue[];

  constructor(issues: readonly ContentIssue[]) {
    super(
      `Invalid content (${issues.length} issue${issues.length > 1 ? 's' : ''}):\n` +
        issues.map((issue) => `- ${formatContentIssue(issue)}`).join('\n'),
    );
    this.name = 'ContentError';
    this.issues = issues;
  }
}

/**
 * Validates the raw content, builds the registries and checks cross-references.
 * Throws a ContentError listing every problem (file, id, field). Used by the server and the client.
 */
export function loadContent(raw: RawContent): Content {
  const issues: ContentIssue[] = [];
  const content: Content = {
    tiles: parseFile('tiles', 'tile', raw.tiles, tileDefSchema, issues),
    items: parseFile('items', 'item', raw.items, itemDefSchema, issues),
    recipes: parseFile('recipes', 'recipe', raw.recipes, recipeDefSchema, issues),
    loot: parseFile('loot', 'loot table', raw.loot, lootTableSchema, issues),
    creatures: parseFile('creatures', 'creature', raw.creatures, creatureDefSchema, issues),
  };
  // Reference checks only make sense once every entry is valid.
  if (issues.length === 0) {
    checkReferences(content, issues);
  }
  if (issues.length > 0) {
    throw new ContentError(issues);
  }
  return content;
}

function parseFile<T extends { id: string }>(
  file: ContentFile,
  kind: string,
  data: unknown,
  schema: z.ZodType<T>,
  issues: ContentIssue[],
): Registry<T> {
  if (!Array.isArray(data)) {
    issues.push({ file, message: 'expected a JSON array of entries' });
    return new Registry(kind, []);
  }
  const entries: T[] = [];
  const seen = new Set<string>();
  data.forEach((entry: unknown, position) => {
    const result = schema.safeParse(entry);
    if (!result.success) {
      const id = rawId(entry) ?? `#${position}`;
      for (const issue of result.error.issues) {
        issues.push({
          file,
          id,
          ...(issue.path.length > 0 ? { field: issue.path.join('.') } : {}),
          message: issue.message,
        });
      }
      return;
    }
    if (seen.has(result.data.id)) {
      issues.push({ file, id: result.data.id, field: 'id', message: 'duplicate id' });
      return;
    }
    seen.add(result.data.id);
    entries.push(result.data);
  });
  return new Registry(kind, entries);
}

function rawId(entry: unknown): string | undefined {
  if (
    typeof entry === 'object' &&
    entry !== null &&
    'id' in entry &&
    typeof entry.id === 'string'
  ) {
    return entry.id;
  }
  return undefined;
}

function checkReferences(content: Content, issues: ContentIssue[]): void {
  const expect = <T extends { id: string }>(
    registry: Registry<T>,
    target: string,
    file: ContentFile,
    id: string,
    field: string,
  ) => {
    if (!registry.has(target)) {
      issues.push({ file, id, field, message: `unknown ${registry.kind} "${target}"` });
    }
  };

  const stations = new Set<string>();
  for (const tile of content.tiles.all) {
    if (tile.station) {
      stations.add(tile.station);
    }
    if (tile.loot) {
      expect(content.loot, tile.loot, 'tiles', tile.id, 'loot');
    }
  }

  for (const item of content.items.all) {
    if (item.place) {
      expect(content.tiles, item.place, 'items', item.id, 'place');
    }
  }

  for (const recipe of content.recipes.all) {
    recipe.inputs.forEach((input, i) => {
      expect(content.items, input.item, 'recipes', recipe.id, `inputs.${i}.item`);
    });
    recipe.outputs.forEach((output, i) => {
      expect(content.items, output.item, 'recipes', recipe.id, `outputs.${i}.item`);
    });
    if (recipe.station && !stations.has(recipe.station)) {
      issues.push({
        file: 'recipes',
        id: recipe.id,
        field: 'station',
        message: `no tile provides the station "${recipe.station}"`,
      });
    }
  }

  for (const table of content.loot.all) {
    table.drops.forEach((drop, i) => {
      expect(content.items, drop.item, 'loot', table.id, `drops.${i}.item`);
    });
  }

  for (const creature of content.creatures.all) {
    if (creature.loot) {
      expect(content.loot, creature.loot, 'creatures', creature.id, 'loot');
    }
  }
}

/** Number of entries per content file, for logs. */
export function contentSizes(content: Content): Record<ContentFile, number> {
  return {
    tiles: content.tiles.size,
    items: content.items.size,
    recipes: content.recipes.size,
    loot: content.loot.size,
    creatures: content.creatures.size,
  };
}
