import {
  baseContent,
  Chunk,
  type ClientMessage,
  encodeChunk,
  encodeMessage,
  type Inventory,
  loadContent,
  NET,
  PLAYER,
  PROTOCOL_VERSION,
  parseClientMessage,
  type ServerMessage,
  TypedEmitter,
  tileCode,
  tileIndex,
  VIEW,
} from '@8box/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearActions, useActionsStore } from '../store/actions';
import { useChatStore } from '../store/chat';
import { useClockStore } from '../store/clock';
import { clearCrafting, useCraftingStore } from '../store/crafting';
import { useInventoryStore } from '../store/inventory';
import { useSessionStore } from '../store/session';
import { clearSurvival, useSurvivalStore } from '../store/survival';
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

    client.connect({ devName: 'Ana' });
    expect(state().status).toBe('connecting');
    lastSocket().open();

    expect(lastSocket().sent[0]).toEqual({ t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', skin: 'theo', position: SPAWN },
      tick: 10,
    });
    expect(state()).toMatchObject({ status: 'online', player: { entity: 3, name: 'Ana' } });
  });

  it('asks the server for a skin and shows it once a snapshot confirms it', () => {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', skin: 'freddy', position: SPAWN },
      tick: 1,
    });
    expect(state().player?.skin).toBe('freddy');
    expect(client.localView()?.skin).toBe('freddy');

    client.setSkin('cat');
    expect(lastSocket().sent.at(-1)).toEqual({ t: 'setSkin', skin: 'cat' });
    expect(state().player?.skin).toBe('freddy');

    lastSocket().receive({
      t: 'snapshot',
      tick: 2,
      ackSeq: -1,
      you: { x: SPAWN.x, y: SPAWN.y, facing: 'down', skin: 'cat' },
      entities: [],
    });
    expect(state().player?.skin).toBe('cat');
    expect(client.localView()?.skin).toBe('cat');
  });

  it('measures the ping from the pong', () => {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', skin: 'theo', position: SPAWN },
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
    client.connect({ devName: 'Ana' });
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
      you: { entity: 1, name: 'Ana', skin: 'theo', position: SPAWN },
      tick: 1,
    });
    lastSocket().drop();
    vi.advanceTimersByTime(NET.reconnectDelayMs);
    expect(sockets).toHaveLength(9);
  });

  it('stops after a refusal and keeps the reason', () => {
    const client = createClient(PROTOCOL_VERSION + 1);
    client.connect({ devName: 'Ana' });
    lastSocket().open();

    lastSocket().receive({ t: 'rejected', reason: 'outdated' });
    lastSocket().drop();
    vi.advanceTimersByTime(60_000);

    expect(state()).toMatchObject({ status: 'rejected', rejectReason: 'outdated' });
    expect(sockets).toHaveLength(1);
  });

  it('goes back to idle without reconnecting when disconnected on purpose', () => {
    const client = createClient();
    client.connect({ devName: 'Ana' });
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
      you: { entity: 1, name: 'Ana', skin: 'theo', position: SPAWN },
      tick: 1,
    });

  it('stores the chunks it receives and forgets them when the connection drops', () => {
    const client = createClient();
    const unloaded: string[] = [];
    bus.on('chunk.unloaded', ({ cx, cy }) => unloaded.push(`${cx},${cy}`));
    client.connect({ devName: 'Ana' });
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
    client.connect({ devName: 'Ana' });
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

  it('sends the held direction at once, then once per input interval, nothing while still', () => {
    const client = createClient();
    client.connect({ devName: 'Ana' });
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
      { t: 'input', seq: 2, dir: 3 },
      { t: 'input', seq: 3, dir: 0 },
    ]);
  });

  it('predicts the player at once, glides between steps and reconciles with snapshots', () => {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    lastSocket().receive(encodeChunk(new Chunk(0, 16, 16), content));
    welcome();
    expect(client.localView()).toEqual({
      entity: 1,
      x: 512.5,
      y: 512.5,
      facing: 'down',
      moving: false,
      skin: 'theo',
    });
    const step = (PLAYER.speedTilesPerSecond * NET.clientInputIntervalMs) / 1000;

    bus.emit('input.direction', { dir: 3 }); // Right, sent and predicted now.
    expect(client.localView()).toMatchObject({ x: 512.5, facing: 'right', moving: true });
    clock = NET.clientInputIntervalMs / 2;
    expect(client.localView()?.x).toBeCloseTo(512.5 + step / 2);
    clock = NET.clientInputIntervalMs;
    expect(client.localView()?.x).toBeCloseTo(512.5 + step);

    // The server agrees: nothing moves.
    const snapshot = (x: number) =>
      lastSocket().receive({
        t: 'snapshot',
        tick: 7,
        ackSeq: 0,
        you: { x, y: 512.5, facing: 'right' },
        entities: [],
      });
    snapshot(512.5 + step);
    expect(client.localView()?.x).toBeCloseTo(512.5 + step);

    // The server corrects a little: no jump, then the drawing reaches the server position.
    snapshot(512.6);
    expect(client.localView()?.x).toBeCloseTo(512.5 + step);
    clock += 2000;
    expect(client.localView()?.x).toBeCloseTo(512.6);
  });

  it('does not predict into chunks it has not received', () => {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    welcome();

    bus.emit('input.direction', { dir: 3 });
    vi.advanceTimersByTime(NET.clientInputIntervalMs * 3);
    clock = 1000;

    // It reaches the edge of its own tile, not the unknown tile beyond.
    const view = client.localView();
    expect(view?.x).toBeCloseTo(513 - PLAYER.hitboxSizeTiles / 2);
    expect(view).toMatchObject({ facing: 'right', moving: false });
  });

  it('delays messages both ways with a simulated latency (dev)', () => {
    const client = new GameClient({
      serverUrl: 'http://localhost:3000',
      content,
      bus,
      lagMs: 100,
      createSocket: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      now: () => clock,
    });
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    expect(lastSocket().sent).toEqual([]);
    vi.advanceTimersByTime(50);
    expect(lastSocket().sent.map((m) => m.t)).toEqual(['hello']);

    welcome();
    expect(state().status).toBe('connecting');
    vi.advanceTimersByTime(50);
    expect(state().status).toBe('online');
  });

  it('stops sending inputs and forgets the player when the connection is lost', () => {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    welcome();
    const socket = lastSocket();
    socket.drop();
    bus.emit('input.direction', { dir: 1 });
    vi.advanceTimersByTime(NET.clientInputIntervalMs * 3);

    expect(socket.sent.filter((message) => message.t === 'input')).toEqual([]);
    expect(client.localView()).toBeUndefined();
  });
});

describe('GameClient accounts', () => {
  /** Lets the token promise resolve. */
  const flush = () => Promise.resolve().then(() => undefined);

  it('asks Clerk for a fresh token at each connection and sends it in hello', async () => {
    const tokens = ['token-1', 'token-2'];
    const client = createClient();
    client.connect({ getToken: async () => tokens.shift() ?? null });
    await flush();
    lastSocket().open();
    expect(lastSocket().sent).toEqual([
      { t: 'hello', version: PROTOCOL_VERSION, token: 'token-1' },
    ]);

    lastSocket().drop();
    vi.advanceTimersByTime(NET.reconnectDelayMs);
    await flush();
    lastSocket().open();
    expect(lastSocket().sent[0]).toMatchObject({ token: 'token-2' });
  });

  it('shows the account screen of a status, and sends the chosen name', async () => {
    const client = createClient();
    client.connect({ getToken: async () => 'token' });
    await flush();
    lastSocket().open();

    lastSocket().receive({ t: 'status', state: 'needsName' });
    expect(state()).toMatchObject({
      status: 'account',
      account: { state: 'needsName', reason: null, nameError: null },
    });

    client.setName('Ana');
    expect(lastSocket().sent.at(-1)).toEqual({ t: 'setName', name: 'Ana' });
    lastSocket().receive({ t: 'status', state: 'needsName', nameError: 'taken' });
    expect(state().account?.nameError).toBe('taken');
    lastSocket().receive({ t: 'status', state: 'pending' });
    expect(state().account?.state).toBe('pending');
  });

  it('does not reconnect after a ban, and keeps the reason', async () => {
    const client = createClient();
    client.connect({ getToken: async () => 'token' });
    await flush();
    lastSocket().open();

    lastSocket().receive({ t: 'status', state: 'banned', reason: 'griefing' });
    lastSocket().drop();
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(1);
    expect(state()).toMatchObject({
      status: 'account',
      account: { state: 'banned', reason: 'griefing' },
    });
  });

  it('stops when the player is signed out (no token)', async () => {
    const client = createClient();
    client.connect({ getToken: async () => null });
    await flush();

    expect(sockets).toHaveLength(0);
    expect(state()).toMatchObject({ status: 'rejected', rejectReason: 'invalidToken' });
  });

  it('sends chat lines, keeps what it receives, and asks for bubbles of lines said nearby', () => {
    const client = createClient();
    const said: ClientEvents['chat.said'][] = [];
    bus.on('chat.said', (event) => said.push(event));
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', skin: 'theo', position: SPAWN },
      tick: 1,
    });

    client.say('salut');
    client.say('ok', 'Bob');
    expect(lastSocket().sent.filter((message) => message.t === 'chat')).toEqual([
      { t: 'chat', text: 'salut' },
      { t: 'chat', text: 'ok', to: 'Bob' },
    ]);

    const ts = 1_760_000_000_000;
    lastSocket().receive({
      t: 'chat',
      channel: 'proximity',
      from: 'Ana',
      entity: 3,
      text: 'salut',
      ts,
    });
    lastSocket().receive({ t: 'chat', channel: 'private', from: 'Bob', to: 'Ana', text: 'yo', ts });
    lastSocket().receive({ t: 'chatNotice', notice: 'tooFast' });

    expect(said).toEqual([{ entity: 3, text: 'salut' }]);
    const chat = useChatStore.getState();
    expect(chat.entries).toEqual([
      {
        id: expect.any(Number),
        kind: 'line',
        channel: 'proximity',
        from: 'Ana',
        text: 'salut',
        ts,
        own: true,
      },
      {
        id: expect.any(Number),
        kind: 'line',
        channel: 'private',
        from: 'Bob',
        to: 'Ana',
        text: 'yo',
        ts,
        own: false,
      },
      { id: expect.any(Number), kind: 'notice', notice: 'tooFast' },
    ]);
    expect(chat.partner).toBe('Bob');

    client.disconnect();
    expect(useChatStore.getState().entries).toEqual([]);
  });
});

describe('GameClient inventory', () => {
  const LOG = { item: 'base:oak_log', count: 12 };

  function online() {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', skin: 'theo', position: SPAWN },
      tick: 1,
    });
    return client;
  }

  function receiveInventory(selected: number, slots: Inventory['slots'] = [LOG]) {
    lastSocket().receive({ t: 'inventory', slots, equipment: {}, purse: 40, selected });
  }

  const sentOf = (type: ClientMessage['t']) =>
    lastSocket().sent.filter((message) => message.t === type);

  beforeEach(() => {
    useInventoryStore.setState({ inventory: null, open: false });
  });

  it('shows the inventory the server sends, and forgets it when the connection drops', () => {
    online();
    receiveInventory(0);
    expect(useInventoryStore.getState().inventory).toEqual({
      slots: [LOG],
      equipment: {},
      purse: 40,
      selected: 0,
    });

    lastSocket().drop();
    expect(useInventoryStore.getState().inventory).toBeNull();
  });

  it('asks for hotbar slots by key and wheel; the wheel goes on from the last slot asked', () => {
    online();
    receiveInventory(0);

    bus.emit('hotbar.select', { slot: 9 });
    bus.emit('hotbar.scroll', { delta: 100 });
    bus.emit('hotbar.scroll', { delta: 100 });
    expect(sentOf('invSelect')).toEqual([
      { t: 'invSelect', slot: 9 },
      { t: 'invSelect', slot: 0 },
      { t: 'invSelect', slot: 1 },
    ]);
    // Nothing changes before the server confirms.
    expect(useInventoryStore.getState().inventory?.selected).toBe(0);

    receiveInventory(1);
    bus.emit('hotbar.scroll', { delta: -3 });
    expect(sentOf('invSelect').at(-1)).toEqual({ t: 'invSelect', slot: 0 });
  });

  it('drops the stack in hand (or one item), moves and gives items, and opens the window', () => {
    const client = online();
    receiveInventory(1, [LOG, null]);

    bus.emit('inventory.dropHeld', { one: false });
    expect(sentOf('invDrop')).toEqual([]);
    receiveInventory(0, [LOG, null]);
    bus.emit('inventory.dropHeld', { one: false });
    bus.emit('inventory.dropHeld', { one: true });
    client.moveItems(0, 'bag');
    client.moveItems(0, 1, 6);
    client.dropItems('purse', 5);
    client.devGive('base:apple', 3);

    expect(lastSocket().sent.slice(-6)).toEqual([
      { t: 'invDrop', from: 0 },
      { t: 'invDrop', from: 0, count: 1 },
      { t: 'invMove', from: 0, to: 'bag' },
      { t: 'invMove', from: 0, to: 1, count: 6 },
      { t: 'invDrop', from: 'purse', count: 5 },
      { t: 'devGive', item: 'base:apple', count: 3 },
    ]);

    bus.emit('inventory.toggle', {});
    expect(useInventoryStore.getState().open).toBe(true);
    bus.emit('input.button', { button: 'inventory' });
    expect(useInventoryStore.getState().open).toBe(false);
  });
});

describe('GameClient actions', () => {
  const APPLE_PILE = {
    id: 9,
    kind: 'groundItem',
    x: 512.5,
    y: 513.4,
    facing: 'down',
    anim: 'idle',
    item: 'base:apple',
  } as const;

  function online(admin = false) {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', skin: 'theo', position: SPAWN, ...(admin && { admin }) },
      tick: 1,
    });
    lastSocket().receive({
      t: 'inventory',
      slots: Array(10).fill(null),
      equipment: {},
      purse: 0,
      selected: 0,
    });
    return client;
  }

  /** A snapshot where the player faces down, with a pile of apples on the tile in front. */
  function applesInFront() {
    lastSocket().receive({
      t: 'snapshot',
      tick: 2,
      ackSeq: -1,
      you: { x: SPAWN.x, y: SPAWN.y, facing: 'down' },
      entities: [APPLE_PILE],
    });
    clock = 1000;
  }

  /** The chunk of the spawn, with an oak on the tile in front of the player (in the safe zone). */
  function oakInFront() {
    const chunk = new Chunk(0, 16, 16);
    chunk.slot('object')[tileIndex(0, 1)] = tileCode(content, 'base:oak_tree');
    lastSocket().receive(encodeChunk(chunk, content));
    lastSocket().receive({
      t: 'snapshot',
      tick: 2,
      ackSeq: -1,
      you: { x: SPAWN.x, y: SPAWN.y, facing: 'down' },
      entities: [],
    });
    clock = 1000;
  }

  const sentActions = () => lastSocket().sent.filter((message) => message.t === 'action');
  const actions = () => useActionsStore.getState();

  beforeEach(() => {
    useInventoryStore.setState({ inventory: null, open: false });
    clearActions();
    clearSurvival();
  });

  it('the action key does the main action on the aimed tile, or tells there is nothing', () => {
    const client = online();
    bus.emit('action.main', {});
    expect(sentActions()).toEqual([]);
    expect(actions().feedback?.message).toEqual({ kind: 'nothing' });

    applesInFront();
    expect(client.interaction.aimedTile()).toEqual({ x: 512, y: 513 });
    bus.emit('action.main', {});
    bus.emit('input.button', { button: 'action' });
    expect(sentActions()).toEqual([
      { t: 'action', id: 'pickUp', target: { kind: 'entity', id: 9 } },
      { t: 'action', id: 'pickUp', target: { kind: 'entity', id: 9 } },
    ]);
  });

  it('uses the item in hand only through actions marked `use` (not picking up)', () => {
    online();
    applesInFront();
    bus.emit('action.use', {});
    bus.emit('input.button', { button: 'use' });
    // Nothing to use on the tile: the empty hand hits the air, once (the second is too soon).
    expect(sentActions()).toEqual([{ t: 'action', id: 'attack', target: { kind: 'self' } }]);
  });

  it('hits with a weapon, or bare-handed someone in front: drawn at once, never too fast', () => {
    online();
    const swings: ClientEvents['combat.swing'][] = [];
    const damaged: ClientEvents['combat.damaged'][] = [];
    bus.on('combat.swing', (swing) => swings.push(swing));
    bus.on('combat.damaged', (event) => damaged.push(event));
    const bob = { id: 7, kind: 'player', x: 512.5, y: 513.2, facing: 'up', anim: 'idle' } as const;
    lastSocket().receive({
      t: 'snapshot',
      tick: 2,
      ackSeq: -1,
      you: { x: SPAWN.x, y: SPAWN.y, facing: 'down' },
      entities: [APPLE_PILE, { ...bob, name: 'Bob' }],
    });
    clock = 1000;
    bus.emit('action.use', {}); // Bob stands in front: the empty hand hits him, not the apples.
    clock = 1400;
    bus.emit('action.use', {}); // Too soon bare-handed (500 ms).
    lastSocket().receive({
      t: 'inventory',
      slots: [{ item: 'base:wooden_sword', count: 1 }, ...Array(9).fill(null)],
      equipment: {},
      purse: 0,
      selected: 0,
    });
    clock = 1500;
    bus.emit('input.button', { button: 'use' });
    const attack = { t: 'action', id: 'attack', target: { kind: 'self' } };
    expect(sentActions()).toEqual([attack, attack]);
    expect(swings).toEqual([
      { entity: 3, facing: 'down' },
      { entity: 3, facing: 'down', item: 'base:wooden_sword' },
    ]);
    // What the server tells: others swing, characters get hurt; a hit refused as too soon says nothing.
    lastSocket().receive({ t: 'swing', entity: 7, facing: 'up' });
    lastSocket().receive({ t: 'damaged', entity: 3, amount: 1 });
    lastSocket().receive({ t: 'action', id: 'attack', outcome: 'refused', reason: 'tooSoon' });
    expect(swings.at(-1)).toEqual({ entity: 7, facing: 'up' });
    expect(damaged).toEqual([{ entity: 3, amount: 1 }]);
    expect(actions().feedback).toBeFalsy();
  });

  it('eats the food in hand with Use, unless full', () => {
    online();
    oakInFront();
    lastSocket().receive({
      t: 'inventory',
      slots: [{ item: 'base:apple', count: 2 }, ...Array(9).fill(null)],
      equipment: {},
      purse: 0,
      selected: 0,
    });
    lastSocket().receive({ t: 'vitals', health: 20, hunger: 12 });
    bus.emit('action.use', {});
    expect(sentActions()).toEqual([{ t: 'action', id: 'eat', target: { kind: 'self' } }]);

    lastSocket().receive({ t: 'vitals', health: 20, hunger: 20 });
    bus.emit('action.use', {});
    expect(sentActions()).toHaveLength(1);
    expect(actions().feedback?.message).toEqual({ kind: 'refused', reason: 'full' });
  });

  it('keeps the vitals the server sends; dead, it stands still until it asks to respawn', () => {
    const client = online();
    lastSocket().receive({ t: 'vitals', health: 0, hunger: 0, dead: 'starvation' });
    expect(useSurvivalStore.getState()).toEqual({ health: 0, hunger: 0, dead: 'starvation' });
    bus.emit('input.direction', { dir: 3 });
    vi.advanceTimersByTime(NET.clientInputIntervalMs * 3);
    expect(lastSocket().sent.filter((message) => message.t === 'input')).toEqual([]);

    client.respawn();
    expect(lastSocket().sent.at(-1)).toEqual({ t: 'respawn' });
    lastSocket().receive({ t: 'vitals', health: 20, hunger: 20 });
    expect(useSurvivalStore.getState().dead).toBeNull();
    vi.advanceTimersByTime(NET.clientInputIntervalMs);
    expect(lastSocket().sent.at(-1)).toMatchObject({ t: 'input', dir: 3 });

    lastSocket().drop();
    expect(useSurvivalStore.getState()).toEqual({ health: null, hunger: null, dead: null });
  });

  it('runs the world clock the server sends and shows it on the HUD, until offline', () => {
    const client = online();
    expect(client.worldTime()).toBeUndefined();
    lastSocket().receive({ t: 'time', worldTimeMs: 1000, scale: 60 });
    expect(client.worldTime()).toBe(1000);
    expect(useClockStore.getState().clock).toEqual({ hours: 6, minutes: 0, daytime: true });

    clock += 1000;
    vi.advanceTimersByTime(VIEW.uiSyncIntervalMs);
    expect(client.worldTime()).toBe(61_000);
    expect(useClockStore.getState().clock).toEqual({ hours: 6, minutes: 24, daytime: true });

    lastSocket().drop();
    expect(client.worldTime()).toBeUndefined();
    expect(useClockStore.getState().clock).toBeNull();
  });

  it('opens the menu of a tile in reach, greys what cannot be done, and sends the choice', () => {
    const client = online();
    applesInFront();
    bus.emit('world.menu', { x: 512, y: 513, screen: { x: 300, y: 200 } });
    expect(actions().menu).toEqual({
      x: 512,
      y: 513,
      left: 300,
      top: 200,
      entries: [
        {
          id: 'pickUp',
          labelKey: 'ui.actions.pickUp',
          name: { content: 'base:apple' },
          target: { kind: 'entity', id: 9 },
          reason: null,
        },
        {
          id: 'examine',
          labelKey: 'ui.actions.examine',
          name: { content: 'base:apple' },
          target: { kind: 'entity', id: 9 },
          reason: null,
        },
      ],
    });

    client.performAction('examine', { kind: 'entity', id: 9 });
    expect(actions().menu).toBeNull();
    expect(sentActions()).toEqual([
      { t: 'action', id: 'examine', target: { kind: 'entity', id: 9 } },
    ]);

    // Out of reach: no menu, the player is told why.
    bus.emit('world.menu', { x: 520, y: 513, screen: { x: 300, y: 200 } });
    expect(actions().menu).toBeNull();
    expect(actions().feedback?.message).toEqual({ kind: 'refused', reason: 'outOfReach' });
  });

  it('greys breaking in the safe zone, with the reason', () => {
    online();
    oakInFront();
    bus.emit('action.use', {});
    expect(sentActions()).toEqual([]);
    bus.emit('world.menu', { x: 512, y: 513, screen: { x: 0, y: 0 } });
    expect(actions().menu?.entries.map((entry) => [entry.id, entry.reason])).toEqual([
      ['cut', 'safeZone'],
      ['examine', null],
    ]);
  });

  it('tells why the item in hand cannot be used, when nothing can be done with it', () => {
    online();
    oakInFront();
    bus.emit('action.use', {});
    expect(actions().feedback?.message).toEqual({ kind: 'refused', reason: 'safeZone' });
  });

  it('places the item in hand on the free tile in front', () => {
    online(true); // An admin: the spawn is in the safe zone.
    const chunk = new Chunk(0, 16, 16);
    chunk.slot('ground').fill(tileCode(content, 'base:grass'));
    lastSocket().receive(encodeChunk(chunk, content));
    lastSocket().receive({
      t: 'inventory',
      slots: [{ item: 'base:workbench', count: 1 }, ...Array(9).fill(null)],
      equipment: {},
      purse: 0,
      selected: 0,
    });
    lastSocket().receive({
      t: 'snapshot',
      tick: 2,
      ackSeq: -1,
      you: { x: SPAWN.x, y: SPAWN.y, facing: 'down' },
      entities: [],
    });
    clock = 1000;

    bus.emit('action.use', {});

    expect(sentActions()).toEqual([
      { t: 'action', id: 'place', target: { kind: 'tile', x: 512, y: 513 } },
    ]);
  });

  it('lets an admin break things in the safe zone with the item in hand', () => {
    online(true);
    oakInFront();
    bus.emit('action.use', {});
    expect(sentActions()).toEqual([
      { t: 'action', id: 'cut', target: { kind: 'tile', x: 512, y: 513 } },
    ]);
  });

  it('passes the HP of a tile being broken on to the rendering', () => {
    online();
    const damaged: unknown[] = [];
    bus.on('tile.damaged', (damage) => damaged.push(damage));
    lastSocket().receive({ t: 'tileDamage', layer: 0, x: 512, y: 513, hp: 5, maxHp: 6 });
    expect(damaged).toEqual([{ layer: 0, x: 512, y: 513, hp: 5, maxHp: 6 }]);
  });

  it('closes the menu when the player starts walking', () => {
    online();
    applesInFront();
    bus.emit('world.menu', { x: 512, y: 513, screen: { x: 300, y: 200 } });
    expect(actions().menu).not.toBeNull();
    bus.emit('input.direction', { dir: 3 });
    expect(actions().menu).toBeNull();
  });

  it('shows the progress of an action that takes time, what was examined and refusals', () => {
    online();
    lastSocket().receive({ t: 'action', id: 'chop', outcome: 'started', durationMs: 1500 });
    expect(actions().progress).toMatchObject({ id: 'chop', durationMs: 1500 });
    lastSocket().receive({ t: 'action', id: 'chop', outcome: 'cancelled' });
    expect(actions().progress).toBeNull();
    expect(actions().feedback?.message).toEqual({ kind: 'cancelled' });

    lastSocket().receive({ t: 'examined', thing: 'base:apple', count: 3 });
    expect(actions().feedback?.message).toEqual({
      kind: 'examined',
      name: { content: 'base:apple' },
      count: 3,
    });
    lastSocket().receive({ t: 'examined', player: 'Bob' });
    expect(actions().feedback?.message).toEqual({ kind: 'examined', name: { player: 'Bob' } });

    lastSocket().receive({
      t: 'action',
      id: 'pickUp',
      outcome: 'refused',
      reason: 'inventoryFull',
    });
    expect(actions().feedback?.message).toEqual({ kind: 'refused', reason: 'inventoryFull' });

    lastSocket().receive({ t: 'action', id: 'rest', outcome: 'started', durationMs: 500 });
    lastSocket().drop();
    expect(actions()).toEqual({ menu: null, progress: null, feedback: null });
  });
});

describe('GameClient crafting', () => {
  function online() {
    const client = createClient();
    client.connect({ devName: 'Ana' });
    lastSocket().open();
    lastSocket().receive({
      t: 'welcome',
      you: { entity: 3, name: 'Ana', skin: 'theo', position: SPAWN },
      tick: 1,
    });
    return client;
  }

  const crafting = () => useCraftingStore.getState();
  const actions = () => useActionsStore.getState();

  beforeEach(() => {
    useInventoryStore.setState({ inventory: null, open: false });
    clearActions();
    clearCrafting();
  });

  it('opens the crafting window (C, Craft button), which closes the inventory, and back', () => {
    online();
    useInventoryStore.setState({ open: true });

    bus.emit('crafting.toggle', {});
    expect(crafting().open).toBe(true);
    expect(useInventoryStore.getState().open).toBe(false);

    bus.emit('inventory.toggle', {});
    expect(crafting().open).toBe(false);
    expect(useInventoryStore.getState().open).toBe(true);

    bus.emit('input.button', { button: 'craft' });
    expect(crafting().open).toBe(true);
  });

  it('asks for crafts and shows their progress, the end and refusals', () => {
    const client = online();
    client.craft('base:plank', 3);
    expect(lastSocket().sent.at(-1)).toEqual({ t: 'craft', recipe: 'base:plank', count: 3 });

    lastSocket().receive({
      t: 'craft',
      recipe: 'base:plank',
      outcome: 'started',
      durationMs: 500,
      left: 3,
    });
    expect(actions().progress).toMatchObject({ id: 'craft:base:plank', durationMs: 500 });
    expect(crafting().current).toEqual({ recipe: 'base:plank', left: 3 });

    lastSocket().receive({ t: 'craft', recipe: 'base:plank', outcome: 'done' });
    expect(actions().progress).toBeNull();
    expect(crafting().current).toBeNull();
    expect(actions().feedback?.message).toEqual({ kind: 'craftDone' });

    lastSocket().receive({
      t: 'craft',
      recipe: 'base:wooden_axe',
      outcome: 'refused',
      reason: 'noStation',
    });
    expect(actions().feedback?.message).toEqual({
      kind: 'craftRefused',
      reason: 'noStation',
      station: 'base:workbench',
    });

    lastSocket().receive({ t: 'craft', recipe: 'base:plank', outcome: 'cancelled' });
    expect(actions().feedback?.message).toEqual({ kind: 'craftCancelled' });
  });

  it('tells the player when the tool in hand breaks', () => {
    online();
    lastSocket().receive({ t: 'itemBroken', item: 'base:wooden_axe' });
    expect(actions().feedback?.message).toEqual({ kind: 'broken', item: 'base:wooden_axe' });
  });

  it('knows the stations within reach of the player', () => {
    online();
    const chunk = new Chunk(0, 16, 16);
    // A workbench at (514, 513): 1.6 tiles from the feet (512.5, 512.5).
    chunk.slot('object')[tileIndex(2, 1)] = tileCode(content, 'base:workbench');
    lastSocket().receive(encodeChunk(chunk, content));
    lastSocket().receive({
      t: 'snapshot',
      tick: 2,
      ackSeq: -1,
      you: { x: SPAWN.x, y: SPAWN.y, facing: 'down' },
      entities: [],
    });
    clock = 1000;
    vi.advanceTimersByTime(VIEW.uiSyncIntervalMs);
    expect(crafting().stations).toEqual(['base:workbench']);

    lastSocket().receive({
      t: 'tileUpdate',
      layer: 0,
      x: 514,
      y: 513,
      slot: 'object',
      tile: null,
    });
    lastSocket().receive({
      t: 'snapshot',
      tick: 3,
      ackSeq: -1,
      you: { x: SPAWN.x, y: SPAWN.y, facing: 'down' },
      entities: [],
    });
    vi.advanceTimersByTime(VIEW.uiSyncIntervalMs);
    expect(crafting().stations).toEqual([]);
  });
});
