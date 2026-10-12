import { decode, encode } from '@msgpack/msgpack';
import { z } from 'zod';
import { type ClientMessage, clientMessageSchema, type ServerMessage } from './messages';

/** Encodes a message to msgpack. Undefined fields are left out. */
export function encodeMessage(message: ClientMessage | ServerMessage): Uint8Array {
  return encode(message, { ignoreUndefined: true });
}

/** Decodes a server message. The client trusts the server: no validation. */
export function decodeServerMessage(data: ArrayBuffer | Uint8Array): ServerMessage {
  return decode(data) as ServerMessage;
}

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; error: string };

/** Decodes and validates a client message. Never throws: bad input gives `{ ok: false }`. */
export function parseClientMessage(data: Uint8Array): ParseResult {
  let raw: unknown;
  try {
    raw = decode(data);
  } catch {
    return { ok: false, error: 'not valid msgpack' };
  }
  const result = clientMessageSchema.safeParse(raw);
  return result.success
    ? { ok: true, message: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}
