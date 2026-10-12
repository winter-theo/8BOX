import { useConnectionStore } from '../store/connection';

/** Wait before trying to reconnect after the socket closed, in milliseconds. */
const RECONNECT_DELAY_MS = 2000;

export function toWebSocketUrl(serverUrl: string): string {
  const url = new URL('/ws', serverUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * Keeps a WebSocket open to the server (reconnecting when it drops) and mirrors its state
 * in the connection store. Returns a function that closes it for good.
 */
export function startConnection(serverUrl: string): () => void {
  const { setStatus } = useConnectionStore.getState();
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const connect = () => {
    const ws = new WebSocket(toWebSocketUrl(serverUrl));
    socket = ws;
    ws.addEventListener('open', () => ws.send('ping'));
    ws.addEventListener('message', (event) => {
      if (event.data === 'pong') {
        setStatus('online');
      }
    });
    ws.addEventListener('close', () => {
      setStatus('offline');
      if (!stopped) {
        retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    });
  };

  connect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
