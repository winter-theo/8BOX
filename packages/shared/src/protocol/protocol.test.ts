import { encode } from '@msgpack/msgpack';
import { describe, expect, it } from 'vitest';
import { CHAT } from '../config/chat';
import { PLAYER } from '../config/player';
import { decodeServerMessage, encodeMessage, parseClientMessage } from './codec';
import {
  CLIENT_MESSAGE_TYPES,
  type ClientMessage,
  clientMessageSchema,
  isValidPlayerName,
  type ServerMessage,
} from './messages';
import { PROTOCOL_VERSION } from './version';

const clientMessages: ClientMessage[] = [
  { t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana_42' },
  { t: 'hello', version: PROTOCOL_VERSION },
  { t: 'hello', version: PROTOCOL_VERSION, token: 'eyJhbGciOi.payload.signature' },
  { t: 'setName', name: 'Ana' },
  { t: 'ping', time: 123456.789 },
  { t: 'input', seq: 12, dir: 3 },
  { t: 'viewport', w: 1280, h: 720, zoom: 4 },
  { t: 'debugCamera', at: { x: 512.5, y: 498.25 } },
  { t: 'debugCamera', at: null },
  { t: 'chat', text: 'Salut !' },
  { t: 'chat', text: '/msg Ana_42 on se retrouve au lac ?' },
  { t: 'chat', text: 'oui', to: 'Ana_42' },
];

const serverMessages: ServerMessage[] = [
  {
    t: 'welcome',
    you: { entity: 7, name: 'Ana_42', position: { layer: 0, x: 512.5, y: 512.5 } },
    tick: 1200,
  },
  { t: 'chunkUnload', layer: 0, cx: 3, cy: 4 },
  { t: 'tileUpdate', layer: 0, x: 10, y: 20, slot: 'object', tile: 'base:flowers' },
  { t: 'tileUpdate', layer: 0, x: 10, y: 20, slot: 'object', tile: null },
  { t: 'rejected', reason: 'outdated' },
  { t: 'pong', time: 123456.789 },
  {
    t: 'chat',
    channel: 'proximity',
    from: 'Ana_42',
    entity: 7,
    text: 'Salut !',
    ts: 1_760_000_000_000,
  },
  { t: 'chat', channel: 'private', from: 'Ana_42', to: 'Bob', text: 'oui', ts: 1_760_000_000_000 },
  { t: 'chatNotice', notice: 'muted', until: 1_760_000_600_000 },
  { t: 'chatNotice', notice: 'unknownPlayer', name: 'Bob' },
];

describe('codec', () => {
  it.each(clientMessages)('round-trips the client message %j', (message) => {
    expect(parseClientMessage(encodeMessage(message))).toEqual({ ok: true, message });
  });

  it.each(serverMessages)('round-trips the server message %j', (message) => {
    expect(decodeServerMessage(encodeMessage(message))).toEqual(message);
  });

  it('leaves undefined fields out', () => {
    const decoded = parseClientMessage(
      encodeMessage({ t: 'hello', version: 1, devName: undefined }),
    );
    expect(decoded).toEqual({ ok: true, message: { t: 'hello', version: 1 } });
  });

  it('covers every client message type', () => {
    expect(new Set(clientMessages.map((m) => m.t))).toEqual(new Set(CLIENT_MESSAGE_TYPES));
  });
});

describe('parseClientMessage', () => {
  const invalid: [string, Uint8Array][] = [
    ['garbage bytes', new Uint8Array([0xc1, 0xff, 0x00])],
    ['not an object', encode('hello')],
    ['unknown type', encode({ t: 'teleport', x: 1 })],
    ['missing field', encode({ t: 'hello' })],
    ['wrong field type', encode({ t: 'ping', time: 'now' })],
    ['extra field', encode({ t: 'input', seq: 1, dir: 0, speed: 99 })],
    ['no type', encode({ version: 1 })],
  ];

  it.each(invalid)('rejects %s without throwing', (_label, data) => {
    const result = parseClientMessage(data);
    expect(result.ok).toBe(false);
  });

  it('describes why a message is invalid', () => {
    const result = parseClientMessage(encode({ t: 'ping', time: 'now' }));
    expect(result.ok === false && result.error).toContain('time');
  });

  it('matches the schema for every listed type', () => {
    for (const t of CLIENT_MESSAGE_TYPES) {
      expect(clientMessageSchema.options.some((option) => option.shape.t.value === t)).toBe(true);
    }
  });
});

describe('isValidPlayerName', () => {
  it('accepts 3 to 16 letters, digits and underscores', () => {
    expect(isValidPlayerName('Ana')).toBe(true);
    expect(isValidPlayerName('Theo_Winter_2026')).toBe(true);
  });

  it('rejects other names', () => {
    for (const name of ['Al', 'a'.repeat(17), 'Théo', 'with space', 'semi;colon', '']) {
      expect(isValidPlayerName(name), name).toBe(false);
    }
  });
});

describe('input, viewport and debugCamera messages', () => {
  it('reject values out of range', () => {
    for (const bad of [
      { t: 'viewport', w: 0, h: 720, zoom: 4 },
      { t: 'viewport', w: 1280, h: 100_000, zoom: 4 },
      { t: 'viewport', w: 1280, h: 720, zoom: 2.5 },
      { t: 'viewport', w: 1280, h: 720, zoom: 99 },
      { t: 'debugCamera', at: { x: 'left', y: 0 } },
      { t: 'input', seq: 1, dir: 9 },
      { t: 'input', seq: -1, dir: 0 },
    ]) {
      expect(parseClientMessage(encode(bad)).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('chat messages', () => {
  it('reject lines too long and invalid names', () => {
    for (const bad of [
      { t: 'chat', text: 'a'.repeat(CHAT.maxLineLength + 1) },
      { t: 'chat', text: 'hi', to: '' },
      { t: 'chat', text: 'hi', to: 'a'.repeat(PLAYER.nameMaxLength + 1) },
      { t: 'chat' },
    ]) {
      expect(parseClientMessage(encode(bad)).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});
