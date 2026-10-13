import {
  type ClientMessage,
  type Content,
  chunkCoord,
  createMovementWorld,
  decodeServerMessage,
  encodeMessage,
  heldStack,
  INVENTORY,
  type MovementWorld,
  NET,
  PROTOCOL_VERSION,
  type ServerMessage,
  type Skin,
  type SlotRef,
  VIEW,
} from '@8box/shared';
import { clearChat, receiveChatLine, receiveChatNotice } from '../store/chat';
import { toggleInventoryWindow, useInventoryStore } from '../store/inventory';
import { useSessionStore } from '../store/session';
import type { ClientEventBus } from './events';
import { LocalPlayerState, type LocalView } from './player/LocalPlayerState';
import { ChunkCache } from './world/ChunkCache';
import { RemoteEntities, type RemoteView } from './world/RemoteEntities';

export function toWebSocketUrl(serverUrl: string): string {
  const url = new URL('/ws', serverUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * How the player proves who they are: a dev name (DEV_AUTH servers only), or a signed-in Clerk session
 * (a fresh, short-lived token for each connection).
 */
export type Credentials = { devName: string } | { getToken: () => Promise<string | null> };

export interface GameClientOptions {
  /** Base HTTP URL of the server. */
  serverUrl: string;
  content: Content;
  bus: ClientEventBus;
  /** Version sent in `hello` (only changed in dev, to test the "outdated" screen). */
  protocolVersion?: number;
  /** Creates the socket (tests pass a fake one). */
  createSocket?: (url: string) => WebSocket;
  /** Clock for the ping, in ms. */
  now?: () => number;
  /** Dev only: simulated round trip latency, half on each way, in ms. */
  lagMs?: number;
}

/**
 * Connection to the game server: handshake, ping, reconnection with a growing delay, and the world
 * streamed by the server. Pure TypeScript: it publishes to Phaser through the event bus and to React
 * through the session store.
 */
export class GameClient {
  /** Chunks received from the server. */
  readonly chunks: ChunkCache;
  /** The other entities, from the snapshots. */
  private readonly remotes = new RemoteEntities(1000 / NET.tickRateHz);
  private readonly createSocket: (url: string) => WebSocket;
  private readonly now: () => number;
  private socket: WebSocket | undefined;
  private credentials: Credentials | undefined;
  private attempt = 0;
  /** True when no reconnection must happen (rejected or left on purpose). */
  private stopped = true;
  private online = false;
  private view: { w: number; h: number; zoom: number } | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private inputTimer: ReturnType<typeof setInterval> | undefined;
  /** Direction held now, and the one last sent (no input is sent while standing still). */
  private direction = 0;
  private sentDirection = 0;
  private inputSeq = 0;
  /** The player of this connection, predicted; undefined when not in the world. */
  private local: LocalPlayerState | undefined;
  /** Name of the player of this connection, once welcomed. */
  private name: string | undefined;
  private uiSyncTimer: ReturnType<typeof setTimeout> | undefined;
  /** Hotbar slot last asked for, until the server confirms it (the wheel may ask again before). */
  private requestedSlot: number | undefined;

  constructor(private readonly options: GameClientOptions) {
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.now = options.now ?? (() => performance.now());
    this.chunks = new ChunkCache(options.content, options.bus);
    const { bus } = options;
    bus.on('view.changed', (view) => {
      this.view = view;
      if (this.online) {
        this.send({ t: 'viewport', ...view });
      }
    });
    bus.on('debugCamera.moved', ({ at }) => {
      useSessionStore.setState({ debugCamera: at });
      if (this.online) {
        this.send({ t: 'debugCamera', at });
      }
    });
    bus.on('input.direction', ({ dir }) => {
      const starting = this.direction === 0 && dir !== 0;
      this.direction = dir;
      if (starting && this.inputTimer !== undefined) {
        this.restartInputs(); // Answer the key at once rather than on the next interval.
      }
    });
    bus.on('debug.stats', (stats) => useSessionStore.setState({ debugStats: stats }));
    bus.on('hotbar.select', ({ slot }) => this.selectSlot(slot));
    bus.on('hotbar.scroll', ({ delta }) => this.scrollHotbar(delta));
    bus.on('inventory.dropHeld', ({ one }) => this.dropHeld(one));
    bus.on('inventory.toggle', () => toggleInventoryWindow());
    bus.on('input.button', ({ button }) => {
      if (button === 'inventory') {
        toggleInventoryWindow();
      }
    });
    for (const event of ['chunk.loaded', 'chunk.unloaded'] as const) {
      bus.on(event, () => this.syncUiSoon());
    }
  }

  /** Where to draw the player of this client now (predicted); undefined when not in the world. */
  localView(): LocalView | undefined {
    return this.local?.view(this.now());
  }

  /** Where to draw the other entities now (smoothly, a little in the past). */
  remoteViews(): RemoteView[] {
    return this.remotes.views(this.now());
  }

  /** Joins the game. */
  connect(credentials: Credentials): void {
    this.disconnect();
    this.credentials = credentials;
    this.stopped = false;
    this.attempt = 0;
    useSessionStore.setState({ status: 'connecting', rejectReason: null, account: null });
    this.open();
  }

  /** The name a new player chose (answer to the `needsName` status). */
  setName(name: string): void {
    this.send({ t: 'setName', name });
  }

  /** The skin the player picked: shown once the server confirms it (next snapshot). */
  setSkin(skin: Skin): void {
    this.send({ t: 'setSkin', skin });
  }

  /** Puts the item of a hotbar slot in hand: shown once the server confirms it. */
  selectSlot(slot: number): void {
    if (this.online && Number.isInteger(slot) && slot >= 0 && slot < INVENTORY.mainSlots) {
      this.requestedSlot = slot;
      this.send({ t: 'invSelect', slot });
    }
  }

  /** Next (`delta` > 0) or previous hotbar slot, going round. */
  scrollHotbar(delta: number): void {
    const current = this.requestedSlot ?? useInventoryStore.getState().inventory?.selected ?? 0;
    const slots = INVENTORY.mainSlots;
    this.selectSlot((((current + Math.sign(delta)) % slots) + slots) % slots);
  }

  /** Moves items in the inventory (the whole stack when `count` is absent). */
  moveItems(from: SlotRef, to: SlotRef, count?: number): void {
    this.send({ t: 'invMove', from, to, ...(count !== undefined && { count }) });
  }

  /** Drops items on the ground in front of the player (the whole stack when `count` is absent). */
  dropItems(from: SlotRef | 'purse', count?: number): void {
    this.send({ t: 'invDrop', from, ...(count !== undefined && { count }) });
  }

  /** Drops the stack in hand, or one of its items. */
  dropHeld(one: boolean): void {
    const inventory = useInventoryStore.getState().inventory;
    if (inventory && heldStack(inventory)) {
      this.dropItems(inventory.selected, one ? 1 : undefined);
    }
  }

  /** Dev mode only: gives items to oneself. */
  devGive(item: string, count: number): void {
    this.send({ t: 'devGive', item, count });
  }

  /** Sends a chat line: said nearby, a command (`/msg`…), or a private message to `to`. */
  say(text: string, to?: string): void {
    this.send({ t: 'chat', text, ...(to !== undefined && { to }) });
  }

  /** Leaves the game and goes back to the login screen. */
  disconnect(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    const socket = this.socket;
    this.socket = undefined;
    this.goOffline();
    socket?.close(1000, 'left');
    this.name = undefined;
    clearChat();
    useSessionStore.setState({
      status: 'idle',
      player: null,
      pingMs: null,
      rejectReason: null,
      account: null,
    });
  }

  private open(): void {
    const credentials = this.credentials;
    if (!credentials) {
      return;
    }
    if ('devName' in credentials) {
      this.openSocket({ devName: credentials.devName });
      return;
    }
    // Clerk session tokens are short-lived: a fresh one for each connection.
    credentials.getToken().then(
      (token) => {
        if (this.stopped || this.credentials !== credentials) {
          return;
        }
        if (token === null) {
          this.stopped = true;
          useSessionStore.setState({ status: 'rejected', rejectReason: 'invalidToken' });
          return;
        }
        this.openSocket({ token });
      },
      () => this.retryLater(),
    );
  }

  private openSocket(proof: { devName: string } | { token: string }): void {
    const socket = this.createSocket(toWebSocketUrl(this.options.serverUrl));
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => {
      this.send({
        t: 'hello',
        version: this.options.protocolVersion ?? PROTOCOL_VERSION,
        ...proof,
      });
    };
    socket.onmessage = (event: MessageEvent) => {
      const message = decodeServerMessage(event.data as ArrayBuffer);
      this.afterLag(() => {
        if (socket === this.socket) {
          this.handle(message);
        }
      });
    };
    socket.onclose = () => this.handleClose(socket);
  }

  private handle(message: ServerMessage): void {
    switch (message.t) {
      case 'welcome': {
        const { entity, name, skin, position } = message.you;
        this.attempt = 0;
        this.name = name;
        this.online = true;
        useSessionStore.setState({
          status: 'online',
          player: { entity, name, skin },
          account: null,
        });
        if (this.view) {
          this.send({ t: 'viewport', ...this.view });
        }
        this.local = new LocalPlayerState(
          entity,
          position,
          this.movementWorld(position.layer),
          NET.clientInputIntervalMs,
          skin,
        );
        this.startPing();
        this.startInputs();
        return;
      }
      case 'snapshot':
        this.local?.snapshot(message.ackSeq, message.you, this.now());
        if (message.you.skin !== undefined) {
          this.showOwnSkin(message.you.skin);
        }
        this.remotes.update(message.tick, message.entities, message.gone, this.now());
        this.syncUiSoon();
        return;
      case 'pong':
        useSessionStore.setState({ pingMs: Math.round(this.now() - message.time) });
        return;
      case 'status':
        // Signed in, but not in the game: a name to pick, the admin to wait for, or no entry.
        this.attempt = 0;
        if (message.state === 'denied' || message.state === 'banned') {
          this.stopped = true; // The server closes the socket next.
        }
        useSessionStore.setState({
          status: 'account',
          account: {
            state: message.state,
            reason: message.reason ?? null,
            nameError: message.nameError ?? null,
          },
        });
        return;
      case 'rejected':
        // The server closes the socket next; never retry after a refusal.
        this.stopped = true;
        useSessionStore.setState({
          status: 'rejected',
          rejectReason: message.reason,
          player: null,
        });
        return;
      case 'chunk':
        this.chunks.load(message);
        return;
      case 'chunkUnload':
        this.chunks.unload(message.layer, message.cx, message.cy);
        return;
      case 'tileUpdate':
        this.chunks.applyTileUpdate(message);
        return;
      case 'chat':
        receiveChatLine(message, this.name);
        if (message.entity !== undefined) {
          this.options.bus.emit('chat.said', { entity: message.entity, text: message.text });
        }
        return;
      case 'chatNotice':
        receiveChatNotice(message);
        return;
      case 'inventory': {
        const { t: _type, ...inventory } = message;
        if (inventory.selected === this.requestedSlot) {
          this.requestedSlot = undefined;
        }
        useInventoryStore.setState({ inventory });
        return;
      }
    }
  }

  private handleClose(socket: WebSocket): void {
    if (socket !== this.socket) {
      return; // An older socket, already replaced.
    }
    this.socket = undefined;
    this.goOffline();
    useSessionStore.setState({ pingMs: null });
    if (this.stopped) {
      return;
    }
    this.retryLater();
  }

  private showOwnSkin(skin: Skin): void {
    if (this.local) {
      this.local.skin = skin;
    }
    const player = useSessionStore.getState().player;
    if (player && player.skin !== skin) {
      useSessionStore.setState({ player: { ...player, skin } });
    }
  }

  /** Connects again after a growing delay. */
  private retryLater(): void {
    const delay = Math.min(NET.reconnectDelayMs * 2 ** this.attempt, NET.reconnectMaxDelayMs);
    this.attempt++;
    useSessionStore.setState({ status: 'reconnecting', player: null });
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  /** Connection lost or left: stop pinging and forget the world (the server sends it again). */
  private goOffline(): void {
    this.online = false;
    this.local = undefined;
    this.requestedSlot = undefined;
    useInventoryStore.setState({ inventory: null, open: false });
    this.remotes.clear();
    this.stopPing();
    clearInterval(this.inputTimer);
    this.inputTimer = undefined;
    this.chunks.clear();
  }

  private startPing(): void {
    this.stopPing();
    const ping = () => this.send({ t: 'ping', time: this.now() });
    ping();
    this.pingTimer = setInterval(ping, NET.clientPingIntervalMs);
  }

  /** Sends the held direction 20 times per second (one input per server tick), from seq 0. */
  private startInputs(): void {
    this.inputSeq = 0;
    this.sentDirection = 0;
    this.restartInputs();
  }

  /** Sends an input now, then one per interval. */
  private restartInputs(): void {
    clearInterval(this.inputTimer);
    this.sendInput();
    this.inputTimer = setInterval(() => this.sendInput(), NET.clientInputIntervalMs);
  }

  /** Sends the held direction and predicts it; nothing while still and the server knows it. */
  private sendInput(): void {
    if (this.direction === 0 && this.sentDirection === 0) {
      return;
    }
    const seq = this.inputSeq++;
    this.send({ t: 'input', seq, dir: this.direction });
    this.sentDirection = this.direction;
    this.local?.input(seq, this.direction, this.now());
  }

  /** Movement view of the chunks received: a tile not loaded is solid. */
  private movementWorld(layer: number): MovementWorld {
    return createMovementWorld(
      (x, y, slot) => this.chunks.getTile(layer, x, y, slot),
      (x, y) => this.chunks.get(layer, chunkCoord(x), chunkCoord(y)) !== undefined,
    );
  }

  private stopPing(): void {
    clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  /** Publishes the chunk count and player position to the UI, a few times per second at most. */
  private syncUiSoon(): void {
    if (this.uiSyncTimer !== undefined) {
      return;
    }
    this.uiSyncTimer = setTimeout(() => {
      this.uiSyncTimer = undefined;
      const player = this.localView();
      useSessionStore.setState({
        loadedChunks: this.chunks.size,
        playerPosition: player ? { x: player.x, y: player.y } : null,
      });
    }, VIEW.uiSyncIntervalMs);
  }

  private send(message: ClientMessage): void {
    const socket = this.socket;
    const data = encodeMessage(message);
    this.afterLag(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  }

  /** Runs `action` now, or half the simulated latency later (dev); the order of messages is kept. */
  private afterLag(action: () => void): void {
    const lagMs = this.options.lagMs ?? 0;
    if (lagMs > 0) {
      setTimeout(action, lagMs / 2);
    } else {
      action();
    }
  }
}
