import {
  type ClientMessage,
  decodeServerMessage,
  encodeMessage,
  NET,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { useSessionStore } from '../store/session';

export function toWebSocketUrl(serverUrl: string): string {
  const url = new URL('/ws', serverUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export interface GameClientOptions {
  /** Base HTTP URL of the server. */
  serverUrl: string;
  /** Version sent in `hello` (only changed in dev, to test the "outdated" screen). */
  protocolVersion?: number;
  /** Creates the socket (tests pass a fake one). */
  createSocket?: (url: string) => WebSocket;
  /** Clock for the ping, in ms. */
  now?: () => number;
}

/**
 * Connection to the game server: handshake, ping, and reconnection with a growing delay.
 * Pure TypeScript; it publishes its state in the session store.
 */
export class GameClient {
  private readonly createSocket: (url: string) => WebSocket;
  private readonly now: () => number;
  private socket: WebSocket | undefined;
  private name = '';
  private attempt = 0;
  /** True when no reconnection must happen (rejected or left on purpose). */
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly options: GameClientOptions) {
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.now = options.now ?? (() => performance.now());
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
    this.stopPing();
    const socket = this.socket;
    this.socket = undefined;
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
      case 'welcome':
        this.attempt = 0;
        useSessionStore.setState({ status: 'online', player: message.you });
        this.startPing();
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
    }
  }

  private handleClose(socket: WebSocket): void {
    if (socket !== this.socket) {
      return; // An older socket, already replaced.
    }
    this.socket = undefined;
    this.stopPing();
    useSessionStore.setState({ pingMs: null });
    if (this.stopped) {
      return;
    }
    const delay = Math.min(NET.reconnectDelayMs * 2 ** this.attempt, NET.reconnectMaxDelayMs);
    this.attempt++;
    useSessionStore.setState({ status: 'reconnecting', player: null });
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private startPing(): void {
    this.stopPing();
    const ping = () => this.send({ t: 'ping', time: this.now() });
    ping();
    this.pingTimer = setInterval(ping, NET.clientPingIntervalMs);
  }

  private stopPing(): void {
    clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(encodeMessage(message));
    }
  }
}
