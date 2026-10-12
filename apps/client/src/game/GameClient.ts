import {
  type ClientMessage,
  type Content,
  chunkCoord,
  createMovementWorld,
  decodeServerMessage,
  encodeMessage,
  type MovementWorld,
  NET,
  PROTOCOL_VERSION,
  type ServerMessage,
  VIEW,
} from '@8box/shared';
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
  private name = '';
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
  private uiSyncTimer: ReturnType<typeof setTimeout> | undefined;

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

  /** Joins the game with a dev name. */
  connect(name: string): void {
    this.disconnect();
    this.name = name;
    this.stopped = false;
    this.attempt = 0;
    useSessionStore.setState({ status: 'connecting', rejectReason: null });
    this.open();
  }

  /** Leaves the game and goes back to the login screen. */
  disconnect(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    const socket = this.socket;
    this.socket = undefined;
    this.goOffline();
    socket?.close(1000, 'left');
    useSessionStore.setState({ status: 'idle', player: null, pingMs: null, rejectReason: null });
  }

  private open(): void {
    const socket = this.createSocket(toWebSocketUrl(this.options.serverUrl));
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => {
      this.send({
        t: 'hello',
        version: this.options.protocolVersion ?? PROTOCOL_VERSION,
        devName: this.name,
      });
    };
    socket.onmessage = (event: MessageEvent) => {
      this.handle(decodeServerMessage(event.data as ArrayBuffer));
    };
    socket.onclose = () => this.handleClose(socket);
  }

  private handle(message: ServerMessage): void {
    switch (message.t) {
      case 'welcome': {
        const { entity, name, position } = message.you;
        this.attempt = 0;
        this.online = true;
        useSessionStore.setState({ status: 'online', player: { entity, name } });
        if (this.view) {
          this.send({ t: 'viewport', ...this.view });
        }
        this.local = new LocalPlayerState(
          entity,
          position,
          this.movementWorld(position.layer),
          NET.clientInputIntervalMs,
        );
        this.startPing();
        this.startInputs();
        return;
      }
      case 'snapshot':
        this.local?.snapshot(message.ackSeq, message.you, this.now());
        this.remotes.update(message.tick, message.entities, message.gone, this.now());
        this.syncUiSoon();
        return;
      case 'pong':
        useSessionStore.setState({ pingMs: Math.round(this.now() - message.time) });
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
    const delay = Math.min(NET.reconnectDelayMs * 2 ** this.attempt, NET.reconnectMaxDelayMs);
    this.attempt++;
    useSessionStore.setState({ status: 'reconnecting', player: null });
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  /** Connection lost or left: stop pinging and forget the world (the server sends it again). */
  private goOffline(): void {
    this.online = false;
    this.local = undefined;
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
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(encodeMessage(message));
    }
  }
}
