/**
 * Headless dev clients that walk around at random: to load the server and to watch other players move.
 * The server must accept dev logins (DEV_AUTH=1, as with `pnpm dev`).
 * Usage: pnpm tools:bots <count> [server URL, default http://localhost:3000]
 */
import {
  type ClientMessage,
  decodeServerMessage,
  encodeMessage,
  MAX_DIRECTION,
  NET,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@8box/shared';
import { WebSocket } from 'ws';

/** How long a bot keeps a direction (or stands still), in ms. */
const WALK_MIN_MS = 800;
const WALK_MAX_MS = 3000;
/** Chance to stand still instead of walking, for each new choice. */
const PAUSE_CHANCE = 0.2;
/** Delay between two bots joining, in ms (spreads the load of the first chunks). */
const JOIN_SPACING_MS = 100;
/** A small view, so that bots receive few chunks: in CSS pixels, at the largest zoom. */
const BOT_VIEW = { w: 320, h: 180, zoom: 8 } as const;

const count = Number.parseInt(process.argv[2] ?? '1', 10);
const serverUrl = process.argv[3] ?? 'http://localhost:3000';
if (!Number.isInteger(count) || count < 1) {
  process.stderr.write('Usage: pnpm tools:bots <count> [server URL]\n');
  process.exit(1);
}

function webSocketUrl(base: string): string {
  const url = new URL('/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

/** One bot: joins with its name, then sends one input per server tick, changing course now and then. */
function startBot(name: string): WebSocket {
  const socket = new WebSocket(webSocketUrl(serverUrl));
  let seq = 0;
  let dir = 0;
  let inputTimer: ReturnType<typeof setInterval> | undefined;
  let courseTimer: ReturnType<typeof setTimeout> | undefined;
  const send = (message: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(encodeMessage(message));
    }
  };
  const changeCourse = () => {
    dir = Math.random() < PAUSE_CHANCE ? 0 : 1 + Math.floor(Math.random() * MAX_DIRECTION);
    courseTimer = setTimeout(changeCourse, randomBetween(WALK_MIN_MS, WALK_MAX_MS));
  };

  socket.on('open', () => send({ t: 'hello', version: PROTOCOL_VERSION, devName: name }));
  socket.on('message', (data) => {
    const bytes = Array.isArray(data) ? Buffer.concat(data) : data;
    const message: ServerMessage = decodeServerMessage(new Uint8Array(bytes));
    if (message.t === 'welcome') {
      send({ t: 'viewport', ...BOT_VIEW });
      changeCourse();
      inputTimer = setInterval(
        () => send({ t: 'input', seq: seq++, dir }),
        NET.clientInputIntervalMs,
      );
      process.stdout.write(`${name} joined\n`);
    } else if (message.t === 'rejected') {
      process.stdout.write(`${name} rejected: ${message.reason}\n`);
    }
  });
  socket.on('close', () => {
    clearInterval(inputTimer);
    clearTimeout(courseTimer);
    process.stdout.write(`${name} left\n`);
  });
  socket.on('error', (error) => process.stderr.write(`${name}: ${error.message}\n`));
  return socket;
}

const bots: WebSocket[] = [];
for (let i = 1; i <= count; i++) {
  setTimeout(() => bots.push(startBot(`bot_${String(i).padStart(2, '0')}`)), i * JOIN_SPACING_MS);
}
process.on('SIGINT', () => {
  for (const bot of bots) {
    bot.close(1000, 'bots stopped');
  }
  setTimeout(() => process.exit(0), JOIN_SPACING_MS);
});
