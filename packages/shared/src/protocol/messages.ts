import { z } from 'zod';
import { PLAYER } from '../config/player';
import { VIEW } from '../config/view';
import type { TileSlot } from '../content/schemas';
import type { NameError } from '../moderation/names';
import { type Facing, MAX_DIRECTION } from '../sim/movement';
import type { TileMeta } from '../world/chunk';

// Every message is an object with a `t` field naming its type.

// ─── Client → server: validated by the server (zod) ──────────────────────────

export const helloSchema = z.strictObject({
  t: z.literal('hello'),
  /** PROTOCOL_VERSION of the client. */
  version: z.number().int().nonnegative(),
  /** Clerk session token of the signed-in player (short-lived: only used to open the socket). */
  token: z.string().min(1).max(8192).optional(),
  /** Dev mode only (DEV_AUTH): name to play with, without an account. Checked by the handshake. */
  devName: z.string().optional(),
});

/** The name a new player chooses (`status { state: 'needsName' }`); the server checks it. */
export const setNameSchema = z.strictObject({
  t: z.literal('setName'),
  name: z.string().max(PLAYER.nameMaxLength * 4),
});

export const pingSchema = z.strictObject({
  t: z.literal('ping'),
  /** Client clock when sent, in ms; sent back in `pong`. */
  time: z.number(),
});

/** What the player holds during one client tick (20 per second): the server applies one per tick. */
export const inputSchema = z.strictObject({
  t: z.literal('input'),
  /** Grows by one per input; the server acknowledges the last one applied (`snapshot.ackSeq`). */
  seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  /** Movement direction: an index of `DIRECTIONS` (0 = still). */
  dir: z.number().int().min(0).max(MAX_DIRECTION),
});

const viewportSide = z.number().int().min(1).max(VIEW.maxViewportPx);

/** Size of the game view: the server streams the chunks it can show. */
export const viewportSchema = z.strictObject({
  t: z.literal('viewport'),
  /** Width of the game view, in CSS pixels. */
  w: viewportSide,
  /** Height of the game view, in CSS pixels. */
  h: viewportSide,
  /** Camera zoom: screen pixels per world pixel. */
  zoom: z.number().int().min(VIEW.minZoom).max(VIEW.maxZoom),
});

/** Dev mode only: the free debug camera, which replaces the player for chunk streaming. */
export const debugCameraSchema = z.strictObject({
  t: z.literal('debugCamera'),
  /** Center of the view, in tiles; null when the camera follows the player again. */
  at: z.strictObject({ x: z.number(), y: z.number() }).nullable(),
});

export const clientMessageSchema = z.discriminatedUnion('t', [
  helloSchema,
  setNameSchema,
  pingSchema,
  inputSchema,
  viewportSchema,
  debugCameraSchema,
]);

export type HelloMessage = z.output<typeof helloSchema>;
export type SetNameMessage = z.output<typeof setNameSchema>;
export type PingMessage = z.output<typeof pingSchema>;
export type InputMessage = z.output<typeof inputSchema>;
export type ViewportMessage = z.output<typeof viewportSchema>;
export type DebugCameraMessage = z.output<typeof debugCameraSchema>;
export type ClientMessage = z.output<typeof clientMessageSchema>;
export type ClientMessageType = ClientMessage['t'];

export const CLIENT_MESSAGE_TYPES = [
  'hello',
  'setName',
  'ping',
  'input',
  'viewport',
  'debugCamera',
] as const satisfies readonly ClientMessageType[];

// ─── Server → client: typed, not validated by the client ─────────────────────

/** Why the server refused or ended a session (`rejected`). */
export type RejectReason =
  /** The client protocol version differs: it must reload. */
  | 'outdated'
  /** No session token, or an invalid or expired one: sign in again. */
  | 'invalidToken'
  /** `devName` sent but the dev mode is off on this server. */
  | 'devAuthDisabled'
  /** The name breaks the player name rules. */
  | 'invalidName'
  /** Someone joined with the same name: this older session ends. */
  | 'replaced'
  /** The server cannot take players right now. */
  | 'unavailable';

export interface WorldPosition {
  layer: number;
  /** In tiles. */
  x: number;
  y: number;
}

export interface WelcomeMessage {
  t: 'welcome';
  /** The player of this session. `entity` is only valid for this session. */
  you: { entity: number; name: string; position: WorldPosition };
  /** Server tick when the player joined. */
  tick: number;
}

/** Where an account stands before playing: pick a name, wait for the admin, or not allowed in. */
export type AccountState = 'needsName' | 'pending' | 'denied' | 'banned';

/**
 * Sent instead of `welcome` while the account cannot play yet. `needsName` and `pending` keep the
 * connection open; `denied` and `banned` end it.
 */
export interface StatusMessage {
  t: 'status';
  state: AccountState;
  /** Why the player is banned. */
  reason?: string;
  /** Why the last `setName` was refused. */
  nameError?: NameError;
}

export interface RejectedMessage {
  t: 'rejected';
  reason: RejectReason;
}

export interface PongMessage {
  t: 'pong';
  /** `time` of the ping, unchanged. */
  time: number;
}

/**
 * A whole chunk, sent when the client subscribes to it. Tiles are indices into the chunk's own
 * `palette` of tile ids (index 0 is always '' = empty), so runtime codes never leave the server.
 */
export interface ChunkMessage {
  t: 'chunk';
  layer: number;
  cx: number;
  cy: number;
  palette: string[];
  /** One palette index per tile, row by row: 1 byte each, or 2 (little-endian) when `wide`. */
  ground: Uint8Array;
  floor: Uint8Array;
  object: Uint8Array;
  /** True when the palette has more than 256 entries. */
  wide?: boolean;
  /** Per-tile state: [tile index, meta] pairs. */
  meta: [number, TileMeta][];
}

/** The client no longer receives updates for this chunk and may forget it. */
export interface ChunkUnloadMessage {
  t: 'chunkUnload';
  layer: number;
  cx: number;
  cy: number;
}

/** One slot of one tile changed in a subscribed chunk. */
export interface TileUpdateMessage {
  t: 'tileUpdate';
  layer: number;
  x: number;
  y: number;
  slot: TileSlot;
  /** Tile id, or null when the slot is now empty. */
  tile: string | null;
}

/** Kinds of entities in the world. */
export type EntityKind = 'player' | 'groundItem' | 'monster';

/** How an entity is drawn: standing or walking. */
export type EntityAnim = 'idle' | 'walk';

/** An entity a client sees, as a snapshot carries it. */
export interface EntityState {
  /** Only valid while the entity stays in view (ids are never reused during a server run). */
  id: number;
  kind: EntityKind;
  /** Feet position, in tiles. */
  x: number;
  y: number;
  facing: Facing;
  anim: EntityAnim;
  /** Display name (players), only in the first snapshot where the entity appears for this client. */
  name?: string;
}

/** Sent every tick: the player of this session and the entities in its chunks. */
export interface SnapshotMessage {
  t: 'snapshot';
  /** Server tick. */
  tick: number;
  /** `seq` of the last input applied, or -1 before the first one. */
  ackSeq: number;
  /** The player of this session: feet position in tiles, and facing. */
  you: { x: number; y: number; facing: Facing };
  /** The other entities in the chunks this client receives. */
  entities: EntityState[];
  /** Entities that left this client's view since the last snapshot: forget them. */
  gone?: number[];
}

export type ServerMessage =
  | WelcomeMessage
  | StatusMessage
  | SnapshotMessage
  | RejectedMessage
  | PongMessage
  | ChunkMessage
  | ChunkUnloadMessage
  | TileUpdateMessage;

/** Player name rules (`PLAYER` config). */
export function isValidPlayerName(name: string): boolean {
  return (
    name.length >= PLAYER.nameMinLength &&
    name.length <= PLAYER.nameMaxLength &&
    PLAYER.namePattern.test(name)
  );
}
