import {
  baseContent,
  Chunk,
  type ClientMessage,
  encodeChunk,
  encodeMessage,
  loadContent,
  NET,
  PROTOCOL_VERSION,
  parseClientMessage,
  type ServerMessage,
  TypedEmitter,
} from '@8box/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../store/session';
import type { ClientEvents } from './events';
import { GameClient, toWebSocketUrl } from './GameClient';

/** Stands in for a browser WebSocket; the test drives its events. */
class FakeSocket {
  binaryType = 'blob';
  readyState = 0;
  sent: ClientMessage[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: ArrayBuffer }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {}

  send(data: Uint8Array): void {
    const parsed = parseClientMessage(data);
    if (parsed.ok) {
      this.sent.push(parsed.message);
    }
  }

  close(): void {
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: ServerMessage): void {
    const bytes = encodeMessage(message);
    this.onmessage?.({ data: bytes.slice().buffer });
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

const content = loadContent(baseContent);
const SPAWN = { layer: 0, x: 512.5, y: 512.5 };
let sockets: FakeSocket[] = [];
let bus = new TypedEmitter<ClientEvents>();
let clock = 0;

function createClient(protocolVersion?: number) {
  return new GameClient({
    serverUrl: 'http://localhost:3000',
    content,
    bus,
    ...(protocolVersion !== undefined && { protocolVersion }),
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    now: () => clock,
  });
}

const lastSocket = () => sockets.at(-1) as FakeSocket;
const state = () => useSessionStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  clock = 0;
  bus = new TypedEmitter<ClientEvents>();
  useSessionStore.setState({
    status: 'idle',
    pingMs: null,
    player: null,
    rejectReason: null,
    loadedChunks: 0,
    debugCamera: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GameClient', () => {
  it('builds the WebSocket URL from the server URL', () => {
    expect(toWebSocketUrl('http://localhost:3000')).toBe('ws://localhost:3000/ws');
    expect(toWebSocketUrl('https://8box.example')).toBe('wss://8box.example/ws');
  });

  it('says hello with its name and protocol version, then goes online on welcome', () => {
    const client = createClient();

    client.connect('Ana');
    expect(state().status).toBe('connecting');
    lastSocket().open();

    expect(lastSocket().sent[0]).toEqual({ t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', position: SPAWN },
      tick: 10,
    });
    expect(state()).toMatchObject({ status: 'online', player: { entity: 3, name: 'Ana' } });
  });

  it('measures the ping from the pong', () => {
    const client = createClient();
    client.connect('Ana');
    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', position: SPAWN },
      tick: 10,
    });

    const ping = lastSocket().sent.at(-1);
    expect(ping).toEqual({ t: 'ping', time: 0 });
    clock = 42;
    lastSocket().receive({ t: 'pong', time: 0 });

    expect(state().pingMs).toBe(42);
    vi.advanceTimersByTime(NET.clientPingIntervalMs);
    expect(lastSocket().sent.at(-1)).toEqual({ t: 'ping', time: 42 });
  });

  it('reconnects with a growing delay, capped, and resets it once welcomed', () => {
    const client = createClient();
    client.connect('Ana');
    const waits: number[] = [];

    for (let i = 0; i < 7; i++) {
      const before = sockets.length;
      lastSocket().drop();
      expect(state().status).toBe('reconnecting');
      let waited = 0;
      while (sockets.length === before) {
        vi.advanceTimersByTime(250);
        waited += 250;
      }
      waits.push(waited);
    }

    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);

    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 1, name: 'Ana', position: SPAWN },
      tick: 1,
    });
    lastSocket().drop();
    vi.advanceTimersByTime(NET.reconnectDelayMs);
    expect(sockets).toHaveLength(9);
  });

  it('stops after a refusal and keeps the reason', () => {
    const client = createClient(PROTOCOL_VERSION + 1);
    client.connect('Ana');
    lastSocket().open();

    lastSocket().receive({ t: 'rejected', reason: 'outdated' });
    lastSocket().drop();
    vi.advanceTimersByTime(60_000);

    expect(state()).toMatchObject({ status: 'rejected', rejectReason: 'outdated' });
    expect(sockets).toHaveLength(1);
  });

  it('goes back to idle without reconnecting when disconnected on purpose', () => {
    const client = createClient();
    client.connect('Ana');
    const socket = lastSocket();
    socket.open();

    client.disconnect();
    socket.drop();
    vi.advanceTimersByTime(60_000);

    expect(state().status).toBe('idle');
    expect(sockets).toHaveLength(1);
  });
});

describe('GameClient world streaming', () => {
  const welcome = () =>
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 1, name: 'Ana', position: SPAWN },
      tick: 1,
    });

  it('stores the chunks it receives and forgets them when the connection drops', () => {
    const client = createClient();
    const unloaded: string[] = [];
    bus.on('chunk.unloaded', ({ cx, cy }) => unloaded.push(`${cx},${cy}`));
    client.connect('Ana');
    lastSocket().open();
    welcome();

    lastSocket().receive(encodeChunk(new Chunk(0, 16, 16), content));
    lastSocket().receive(encodeChunk(new Chunk(0, 17, 16), content));
    lastSocket().receive({ t: 'chunkUnload', layer: 0, cx: 17, cy: 16 });
    expect(client.chunks.size).toBe(1);

    lastSocket().drop();
    expect(client.chunks.size).toBe(0);
    expect(unloaded).toEqual(['17,16', '16,16']);
  });

  it('sends the view size and the debug camera once online', () => {
    const client = createClient();
    client.connect('Ana');
    lastSocket().open();
    bus.emit('view.changed', { w: 1280, h: 720, zoom: 4 });
    bus.emit('debugCamera.moved', { at: { x: 10, y: 20 } });
    expect(lastSocket().sent.map((m) => m.t)).toEqual(['hello']);

    welcome();
    bus.emit('debugCamera.moved', { at: { x: 11, y: 20 } });

    expect(lastSocket().sent).toContainEqual({ t: 'viewport', w: 1280, h: 720, zoom: 4 });
    expect(lastSocket().sent).toContainEqual({ t: 'debugCamera', at: { x: 11, y: 20 } });
    expect(state().debugCamera).toEqual({ x: 11, y: 20 });

    bus.emit('debugCamera.moved', { at: null });
    expect(lastSocket().sent.at(-1)).toEqual({ t: 'debugCamera', at: null });
    expect(state().debugCamera).toBeNull();
  });

  it('sends the held direction once per input interval, and nothing while still', () => {
    const client = createClient();
    client.connect('Ana');
    lastSocket().open();
    welcome();
    const inputs = () => lastSocket().sent.filter((message) => message.t === 'input');

    vi.advanceTimersByTime(NET.clientInputIntervalMs * 3);
    expect(inputs()).toEqual([]);

    bus.emit('input.direction', { dir: 3 });
    vi.advanceTimersByTime(NET.clientInputIntervalMs * 2);
    bus.emit('input.direction', { dir: 0 });
    vi.advanceTimersByTime(NET.clientInputIntervalMs * 3);

    expect(inputs()).toEqual([
      { t: 'input', seq: 0, dir: 3 },
      { t: 'input', seq: 1, dir: 3 },
      { t: 'input', seq: 2, dir: 0 },
    ]);
  });

  it('stops sending inputs when the connection is lost', () => {
    const client = createClient();
    client.connect('Ana');
    lastSocket().open();
    welcome();
    bus.emit('input.direction', { dir: 1 });
    const socket = lastSocket();
    socket.drop();
    vi.advanceTimersByTime(NET.clientInputIntervalMs * 3);

    expect(socket.sent.filter((message) => message.t === 'input')).toEqual([]);
  });

  it('passes the player position of each snapshot to Phaser', () => {
    const moves: unknown[] = [];
    bus.on('player.moved', (move) => moves.push(move));
    const client = createClient();
    client.connect('Ana');
    lastSocket().open();
    welcome();

    lastSocket().receive({
      t: 'snapshot',
      tick: 7,
      ackSeq: 3,
      you: { x: 513, y: 512.5, facing: 'right' },
    });

    expect(moves).toEqual([{ x: 513, y: 512.5, facing: 'right' }]);
  });

  it('tells Phaser where the player spawned', () => {
    const spawns: unknown[] = [];
    bus.on('player.spawned', ({ entity, position }) => spawns.push({ entity, position }));
    const client = createClient();
    client.connect('Ana');
    lastSocket().open();

    welcome();

    expect(spawns).toEqual([{ entity: expect.any(Number), position: SPAWN }]);
  });
});
