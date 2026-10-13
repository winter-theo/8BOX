import { ADMIN_ACTIONS, DEFAULT_SKIN, REPORT_STATUSES, type ReportContextLine } from '@8box/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Binary data (PostgreSQL `bytea`), read and written as a Uint8Array. */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  // The driver writes a Buffer as bytea (a plain Uint8Array would not be).
  toDriver: (value) => Buffer.from(value.buffer, value.byteOffset, value.byteLength),
  fromDriver: (value) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/** Key → value settings of the world: its seed, later its clock… */
export const worldState = pgTable('world_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

/**
 * Saved chunks: tiles as indices into the chunk's own palette of tile ids, never runtime codes, so that
 * adding or removing content keeps saves valid (see `chunkSerializer`).
 */
export const chunks = pgTable(
  'chunks',
  {
    layer: smallint('layer').notNull(),
    cx: integer('cx').notNull(),
    cy: integer('cy').notNull(),
    /** Tile ids; index 0 is '' (empty). */
    palette: jsonb('palette').$type<string[]>().notNull(),
    /** Ground, floor then object palette indices, 1 byte each (2, little-endian, past 256 ids). */
    data: bytea('data').notNull(),
    /** Per-tile state: [tile index, meta] pairs. */
    meta: jsonb('meta').$type<[number, Record<string, unknown>][]>().notNull().default([]),
    /** A player built or broke something in it (the regeneration of P12 spares it). */
    hasPlayerBuild: boolean('has_player_build').notNull().default(false),
    /** Format of `palette` and `data`. */
    version: smallint('version').notNull().default(1),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.layer, table.cx, table.cy] })],
);

/** Accounts. Until Clerk (step 11), dev players exist by name only. */
export const players = pgTable(
  'players',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    clerkUserId: text('clerk_user_id').unique(),
    email: text('email'),
    /** Chosen by the player after their first sign-in (unset until then). */
    name: text('name'),
    status: text('status', { enum: ['pending', 'approved', 'denied', 'banned'] })
      .notNull()
      .default('pending'),
    role: text('role', { enum: ['player', 'admin'] })
      .notNull()
      .default('player'),
    banReason: text('ban_reason'),
    mutedUntil: timestamp('muted_until', { withTimezone: true }),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  // Names are unique whatever their case: "Ana" and "ana" are the same player.
  (table) => [uniqueIndex('players_name_lower_idx').on(sql`lower(${table.name})`)],
);

/** Every admin action: who did what, to whom, when. */
export const adminAudit = pgTable(
  'admin_audit',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    adminId: integer('admin_id')
      .notNull()
      .references(() => players.id),
    action: text('action', { enum: ADMIN_ACTIONS }).notNull(),
    targetId: integer('target_id')
      .notNull()
      .references(() => players.id),
    /** Ban reason. */
    reason: text('reason'),
    /** Length of a mute, in minutes. */
    minutes: integer('minutes'),
    createdAt: createdAt(),
  },
  (table) => [index('admin_audit_created_at_idx').on(table.createdAt)],
);

/** Reports of players by other players (`/signaler`), with the chat lines the reporter saw. */
export const reports = pgTable(
  'reports',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    reporterId: integer('reporter_id')
      .notNull()
      .references(() => players.id),
    targetId: integer('target_id')
      .notNull()
      .references(() => players.id),
    reason: text('reason').notNull(),
    /** The last chat lines the reporter saw, the oldest first. */
    context: jsonb('context').$type<ReportContextLine[]>().notNull(),
    status: text('status', { enum: REPORT_STATUSES }).notNull().default('open'),
    /** The admin who resolved or dismissed it, and when. */
    handledBy: integer('handled_by').references(() => players.id),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index('reports_status_created_at_idx').on(table.status, table.createdAt)],
);

/** The character of each player: where it is, its look, inventory, health and hunger. */
export const characters = pgTable('characters', {
  playerId: integer('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),
  layer: smallint('layer').notNull(),
  /** Feet position, in tiles. */
  x: doublePrecision('x').notNull(),
  y: doublePrecision('y').notNull(),
  /** Hit points (0: left while dead) and hunger; null: full (saved before step 20). */
  hp: integer('hp'),
  hunger: integer('hunger'),
  /** Slots (hotbar, then bag): `{ item, count }` or null, as `StoredInventory.slots`. */
  inventory: jsonb('inventory').notNull().default([]),
  /** Worn items by equipment slot: `{ bag: { item, count } }`. */
  equipment: jsonb('equipment').notNull().default({}),
  /** Gold in the purse, in coins. */
  purse: integer('purse').notNull().default(0),
  /** Where the character comes back after death (step 20); null = the world spawn. */
  spawnPoint: jsonb('spawn_point'),
  /** Skin picked by the player (`PLAYER.skins`). */
  skin: text('skin').notNull().default(DEFAULT_SKIN),
  updatedAt: updatedAt(),
});
