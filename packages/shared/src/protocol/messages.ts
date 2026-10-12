import { z } from 'zod';
import { PLAYER } from '../config/player';

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

export const clientMessageSchema = z.discriminatedUnion('t', [
  helloSchema,
  pingSchema,
  inputSchema,
]);

export type HelloMessage = z.output<typeof helloSchema>;
export type PingMessage = z.output<typeof pingSchema>;
export type InputMessage = z.output<typeof inputSchema>;
export type ClientMessage = z.output<typeof clientMessageSchema>;
export type ClientMessageType = ClientMessage['t'];

export const CLIENT_MESSAGE_TYPES = [
  'hello',
  'ping',
  'input',
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

export interface WelcomeMessage {
  t: 'welcome';
  /** The player of this session. `entity` is only valid for this session. */
  you: { entity: number; name: string };
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

export type ServerMessage = WelcomeMessage | RejectedMessage | PongMessage;

/** Player name rules (`PLAYER` config). */
export function isValidPlayerName(name: string): boolean {
  return (
    name.length >= PLAYER.nameMinLength &&
    name.length <= PLAYER.nameMaxLength &&
    PLAYER.namePattern.test(name)
  );
}
