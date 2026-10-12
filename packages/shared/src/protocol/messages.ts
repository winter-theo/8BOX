import { z } from 'zod';
import { PLAYER } from '../config/player';
import { VIEW } from '../config/view';
import type { TileSlot } from '../content/schemas';
import type { TileMeta } from '../world/chunk';

// Every message is an object with a `t` field naming its type.

// ─── Client → server: validated by the server (zod) ──────────────────────────

export const helloSchema = z.strictObject({
  t: z.literal('hello'),
  /** PROTOCOL_VERSION of the client. */
  version: z.number().int().nonnegative(),
  /** Dev mode only (DEV_AUTH): name to play with, without an account. Checked by the handshake. */
  devName: z.string().optional(),
});

export const pingSchema = z.strictObject({
  t: z.literal('ping'),
  /** Client clock when sent, in ms; sent back in `pong`. */
  time: z.number(),
});

/** Player inputs; the movement fields come with step 07. */
export const inputSchema = z.strictObject({
  t: z.literal('input'),
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

/** Dev mode only: position of the free debug camera, which replaces the player for chunk streaming. */
export const debugCameraSchema = z.strictObject({
  t: z.literal('debugCamera'),
  /** Center of the view, in tiles. */
  x: z.number(),
  y: z.number(),
});

export const clientMessageSchema = z.discriminatedUnion('t', [
  helloSchema,
  pingSchema,
  inputSchema,
  viewportSchema,
  debugCameraSchema,
]);

export type HelloMessage = z.output<typeof helloSchema>;
export type PingMessage = z.output<typeof pingSchema>;
export type InputMessage = z.output<typeof inputSchema>;
export type ViewportMessage = z.output<typeof viewportSchema>;
export type DebugCameraMessage = z.output<typeof debugCameraSchema>;
export type ClientMessage = z.output<typeof clientMessageSchema>;
export type ClientMessageType = ClientMessage['t'];

export const CLIENT_MESSAGE_TYPES = [
  'hello',
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

export type ServerMessage =
  | WelcomeMessage
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
