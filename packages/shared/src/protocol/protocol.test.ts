import { encode } from '@msgpack/msgpack';
import { describe, expect, it } from 'vitest';
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
  { t: 'ping', time: 123456.789 },
  { t: 'input' },
];

const serverMessages: ServerMessage[] = [
  { t: 'welcome', you: { entity: 7, name: 'Ana_42' }, tick: 1200 },
  { t: 'rejected', reason: 'outdated' },
  { t: 'pong', time: 123456.789 },
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
    ['extra field', encode({ t: 'input', speed: 99 })],
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
