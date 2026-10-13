import { z } from 'zod';
import { INVENTORY } from '../config/inventory';
import { LIGHT } from '../config/light';

/** Namespaced content id, e.g. `base:oak_log`. */
export const contentIdSchema = z
  .string()
  .regex(/^[a-z0-9_]+:[a-z0-9_]+$/, 'expected a namespaced id like "base:oak_log"');

/** Sprite id resolved by the client asset registry, e.g. `item.oak_log`. */
export const spriteIdSchema = z
  .string()
  .regex(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/, 'expected a sprite id like "item.oak_log"');

/** Layer of a world cell a tile occupies. */
export const tileSlotSchema = z.enum(['ground', 'floor', 'object']);
export const toolKindSchema = z.enum(['axe', 'pickaxe']);
export const equipSlotSchema = z.enum(INVENTORY.equipmentSlots);

const positiveInt = z.number().int().positive();
const durationMs = z.number().int().min(0);

export const tileDefSchema = z.strictObject({
  id: contentIdSchema,
  slot: tileSlotSchema,
  sprite: spriteIdSchema,
  /** Blocks movement. */
  solid: z.boolean(),
  /** Speed multiplier of whoever walks on it (shallow water: 0.5); absent means 1. */
  speedFactor: z.number().positive().max(1).optional(),
  /** Drawn taller than a tile and depth-sorted with entities (trees, walls). */
  tall: z.boolean(),
  /** Hit points; 0 means it cannot be broken. */
  hp: z.number().int().min(0),
  /** Light source. */
  light: z
    .strictObject({
      /** Light radius, in tiles. */
      radiusTiles: z.number().positive().default(LIGHT.defaultRadiusTiles),
    })
    .optional(),
  /** Tool that harvests it best. */
  harvest: z.strictObject({ tool: toolKindSchema }).optional(),
  /** Loot table id rolled when it is harvested or broken. */
  loot: contentIdSchema.optional(),
  /** Crafting station this tile provides (recipes refer to it with `station`). */
  station: contentIdSchema.optional(),
});

export const itemDefSchema = z
  .strictObject({
    id: contentIdSchema,
    sprite: spriteIdSchema,
    /** Max items per inventory slot; defaults to INVENTORY.toolStackSize or defaultStackSize. */
    stack: positiveInt.optional(),
    tags: z.array(z.string().regex(/^[a-z0-9_]+$/, 'expected a lowercase tag')).default([]),
    tool: z
      .strictObject({
        kind: toolKindSchema,
        /** Harvest strength (tier), no unit. */
        power: positiveInt,
        /** Uses before it breaks. */
        durability: positiveInt,
      })
      .optional(),
    weapon: z
      .strictObject({
        /** Damage per hit, in HP. */
        damage: positiveInt,
        /** Time between two hits, in ms. */
        cooldownMs: positiveInt,
        /** Hits before it breaks. */
        durability: positiveInt,
      })
      .optional(),
    food: z
      .strictObject({
        /** Hunger restored when eaten, in hunger points. */
        hunger: positiveInt,
      })
      .optional(),
    /** Tile id placed in the world when the item is used on the ground. */
    place: contentIdSchema.optional(),
    equip: z
      .strictObject({
        slot: equipSlotSchema,
        /** Inventory slots added while equipped (bags), in slots. */
        extraSlots: positiveInt.max(INVENTORY.maxSlots - INVENTORY.mainSlots).optional(),
      })
      .optional(),
  })
  .transform((item) => ({
    ...item,
    stack:
      item.stack ??
      (item.tool || item.weapon ? INVENTORY.toolStackSize : INVENTORY.defaultStackSize),
  }));

const itemCountSchema = z.strictObject({
  item: contentIdSchema,
  count: positiveInt,
});

export const recipeDefSchema = z.strictObject({
  id: contentIdSchema,
  inputs: z.array(itemCountSchema).min(1),
  outputs: z.array(itemCountSchema).min(1),
  /** Crafting station required nearby; none means crafted by hand. */
  station: contentIdSchema.optional(),
  /** Crafting time, in ms. */
  timeMs: durationMs,
});

/** Draft: completed with harvesting (step 16). */
export const lootTableSchema = z.strictObject({
  id: contentIdSchema,
  drops: z.array(
    z.strictObject({
      item: contentIdSchema,
      /** Items given when the drop happens. */
      count: positiveInt.default(1),
      /** Probability of the drop, from 0 to 1. */
      chance: z.number().min(0).max(1).default(1),
    }),
  ),
});

/** Draft: completed with monsters (step 23). */
export const creatureDefSchema = z.strictObject({
  id: contentIdSchema,
  sprite: spriteIdSchema,
  /** Hit points. */
  hp: positiveInt,
  /** Movement speed, in tiles per second. */
  speedTilesPerSecond: z.number().positive(),
  /** Damage per hit, in HP. */
  damage: z.number().int().min(0),
  hostile: z.boolean(),
  loot: contentIdSchema.optional(),
});

export type TileSlot = z.output<typeof tileSlotSchema>;
export type ToolKind = z.output<typeof toolKindSchema>;
export type EquipSlot = z.output<typeof equipSlotSchema>;
export type TileDef = z.output<typeof tileDefSchema>;
export type ItemDef = z.output<typeof itemDefSchema>;
export type RecipeDef = z.output<typeof recipeDefSchema>;
export type LootTable = z.output<typeof lootTableSchema>;
export type CreatureDef = z.output<typeof creatureDefSchema>;
