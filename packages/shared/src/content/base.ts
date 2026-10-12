import creatures from '../../content/creatures.json' with { type: 'json' };
import items from '../../content/items.json' with { type: 'json' };
import loot from '../../content/loot.json' with { type: 'json' };
import recipes from '../../content/recipes.json' with { type: 'json' };
import tiles from '../../content/tiles.json' with { type: 'json' };
import type { RawContent } from './load';

/** Raw JSON of the base content, loaded the same way by the server and the client (`loadContent`). */
export const baseContent: RawContent = { tiles, items, recipes, loot, creatures };
