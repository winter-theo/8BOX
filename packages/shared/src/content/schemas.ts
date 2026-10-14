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
/**
 * How a breakable tile is broken, hit after hit (the action of the same name): `cut` (trees),
 * `uproot` (small plants), `break` (placed objects).
 */
export const harvestActionSchema = z.enum(['cut', 'uproot', 'break']);
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
  /** Water (ground): no monster appears on it. */
  water: z.boolean().optional(),
  /** Drawn taller than a tile and depth-sorted with entities (trees, walls). */
  tall: z.boolean(),
  /** Hit points; 0 means it cannot be broken. */
  hp: z.number().int().min(0),
  /** Light source. */
  light: z
    .strictObject({
      /** Light radius, in tiles. */
      radiusTiles: z
        .number()
        .positive()
        .max(LIGHT.maxRadiusTiles)
        .default(LIGHT.defaultRadiusTiles),
    })
    .optional(),
  /**
   * Broken hit after hit (needs `hp` > 0): each hit takes HP, depending on the item in hand (`tool`
   * is the kind of tool that does the most); at 0 the tile goes away and its `loot` is rolled.
   */
  harvest: z
    .strictObject({
      action: harvestActionSchema,
      /** Kind of tool that harvests it best. */
      tool: toolKindSchema.optional(),
    })
    .optional(),
  /** Loot table id rolled when it is broken. */
  loot: contentIdSchema.optional(),
  /** Picked (berry bush): gives a roll of `loot` and becomes the tile `becomes`, in the same slot. */
  pick: z
    .strictObject({
      /** Loot table id rolled when it is picked. */
      loot: contentIdSchema,
      /** Tile id it turns into once picked. */
      becomes: contentIdSchema,
    })
    .optional(),
  /** Grows back (picked berry bush): turns into the tile `into` after `afterMs`, in the same slot. */
  regrow: z
    .strictObject({
      /** Tile id it turns back into. */
      into: contentIdSchema,
      /** Time before it does, in ms. */
      afterMs: positiveInt,
    })
    .optional(),
  /** Crafting station this tile provides (recipes refer to it with `station`). */
  station: contentIdSchema.optional(),
  /** A wall: drawn joined to the walls and doors on its 4 sides (sprite `<sprite>.<sides>`). */
  wall: z.boolean().optional(),
  /**
   * A door: players open and close it, its state is in the meta of its tile (`open`). Open, it does not
   * block even when `solid` (sprite `<sprite>.open`).
   */
  door: z.boolean().optional(),
  /** A bed: "sleep here" makes it the respawn point of the player. */
  bed: z.boolean().optional(),
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

/** One possible drop of a loot table: `min` to `max` items (both included), with a probability. */
export const lootDropSchema = z
  .strictObject({
    item: contentIdSchema,
    /** Fewest items given when the drop happens. */
    min: positiveInt.default(1),
    /** Most items given when the drop happens; absent means `min`. */
    max: positiveInt.optional(),
    /** Probability of the drop, from 0 to 1. */
    chance: z.number().min(0).max(1).default(1),
  })
  .refine((drop) => drop.max === undefined || drop.max >= drop.min, {
    message: 'max must not be lower than min',
    path: ['max'],
  });

/** What breaking or picking something gives (each drop rolled on its own). */
export const lootTableSchema = z.strictObject({
  id: contentIdSchema,
  drops: z.array(lootDropSchema),
});

/** A creature of the world: night monsters (later animals). */
export const creatureDefSchema = z.strictObject({
  id: contentIdSchema,
  sprite: spriteIdSchema,
  /** Hit points. */
  hp: positiveInt,
  /** Movement speed while it moves, in tiles per second. */
  speedTilesPerSecond: z.number().positive(),
  /** Moves by hops (slime): `moveMs` moving, then `restMs` still, again and again. */
  hop: z
    .strictObject({
      /** Time it moves, in ms. */
      moveMs: positiveInt,
      /** Time it then stays still, in ms. */
      restMs: positiveInt,
    })
    .optional(),
  /** Damage per hit, to a character or to a wall in its way, in HP. */
  damage: z.number().int().min(0),
  /** Time between two hits, in ms. */
  attackCooldownMs: positiveInt,
  hostile: z.boolean(),
  /** Relative chance to be the one that appears at night; absent: it never appears at night. */
  nightSpawnWeight: z.number().positive().optional(),
  /** Loot table id rolled where it dies. */
  loot: contentIdSchema.optional(),
});

export type TileSlot = z.output<typeof tileSlotSchema>;
export type ToolKind = z.output<typeof toolKindSchema>;
export type HarvestAction = z.output<typeof harvestActionSchema>;
export type LootDrop = z.output<typeof lootDropSchema>;
export type EquipSlot = z.output<typeof equipSlotSchema>;
export type TileDef = z.output<typeof tileDefSchema>;
export type ItemDef = z.output<typeof itemDefSchema>;
export type RecipeDef = z.output<typeof recipeDefSchema>;
export type LootTable = z.output<typeof lootTableSchema>;
export type CreatureDef = z.output<typeof creatureDefSchema>;
