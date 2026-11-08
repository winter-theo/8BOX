/**
 * Headless dev clients: to load the server, to watch other players move, or to test combat.
 * The server must accept dev logins (DEV_AUTH=1, as with `pnpm dev`).
 * Usage: pnpm tools:bots <count> [server URL, default http://localhost:3000] [--attack [player name]]
 * Without --attack, the bots walk around at random. With it, they chase and hit (bare-handed) the named
 * player, or the nearest player who is not a bot, and walk at random while they see no one. Players never
 * hurt each other in the safe zone around the spawn: lead the bots out of it.
 */
import {
  type ClientMessage,
  COMBAT,
  decodeServerMessage,
  directionOf,
  encodeMessage,
  type Facing,
  INVENTORY,
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
/** Attackers see farther, to spot their target (about 120 × 68 tiles): in CSS pixels, at zoom 1. */
const ATTACKER_VIEW = { w: 960, h: 540, zoom: 1 } as const;
/** An attacker walks at its target down to this distance, then only turns to face it, in tiles. */
const ATTACK_CLOSE_TILES = 0.8;
/** An attacker facing its target hits while it is this close, in tiles (`COMBAT.hitRangeTiles` + a body). */
const ATTACK_REACH_TILES = 1.2;
/** An attacker does not move along an axis where its target is closer than this, in tiles (no zigzag). */
const AXIS_DEAD_ZONE_TILES = 0.3;
/** Margin added to the cooldown of a bare-handed hit, so that the server never finds it too soon, in ms. */
const HIT_MARGIN_MS = 50;
/** Time a dead bot waits before coming back to life, in ms. */
const RESPAWN_DELAY_MS = 3000;
/** Bots are named `bot_01`, `bot_02`…: an attacker without a target name never picks one of them. */
const BOT_NAME_PREFIX = 'bot_';

const args = process.argv.slice(2);
const attackAt = args.indexOf('--attack');
/** `--attack` and the target name after it, removed from the positional arguments. */
const attackArgs = attackAt < 0 ? [] : args.splice(attackAt);
const attacking = attackArgs.length > 0;
/** The player to attack; undefined: the nearest player who is not a bot. */
const targetName = attackArgs[1]?.toLowerCase();
const count = Number.parseInt(args[0] ?? '1', 10);
const serverUrl = args[1] ?? 'http://localhost:3000';
if (!Number.isInteger(count) || count < 1) {
  process.stderr.write('Usage: pnpm tools:bots <count> [server URL] [--attack [player name]]\n');
  process.exit(1);
}

function webSocketUrl(base: string): string {
  const url = new URL('/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

/** Facing toward a point (dx, dy) away: along the longer axis. */
function facingToward(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

/** Direction index of one step toward each facing. */
const FACING_DIRECTION: Readonly<Record<Facing, number>> = {
  up: directionOf(0, -1),
  down: directionOf(0, 1),
  left: directionOf(-1, 0),
  right: directionOf(1, 0),
};

/** Where a bot stands, from its last snapshot. */
interface Self {
  x: number;
  y: number;
  facing: Facing;
}

/**
 * How an attacker moves toward a target (dx, dy) away, and whether it may hit: it walks at the target,
 * then, once close, turns to face it and stands still.
 */
function steer(self: Self, dx: number, dy: number): { dir: number; canHit: boolean } {
  const distance = Math.hypot(dx, dy);
  const facing = facingToward(dx, dy);
  if (distance > ATTACK_CLOSE_TILES) {
    const stepX = Math.abs(dx) > AXIS_DEAD_ZONE_TILES ? dx : 0;
    const stepY = Math.abs(dy) > AXIS_DEAD_ZONE_TILES ? dy : 0;
    return {
      dir: directionOf(stepX, stepY),
      canHit: distance <= ATTACK_REACH_TILES && self.facing === facing,
    };
  }
  return self.facing === facing
    ? { dir: 0, canHit: true }
    : { dir: FACING_DIRECTION[facing], canHit: false };
}

/**
 * One bot: joins with its name, then sends one input per server tick. It walks at random, changing
 * course now and then; an attacker chases its target instead whenever it sees one. A dead bot comes back
 * to life after a moment.
 */
function startBot(name: string): WebSocket {
  const socket = new WebSocket(webSocketUrl(serverUrl));
  let seq = 0;
  let wanderDir = 0;
  let inputTimer: ReturnType<typeof setInterval> | undefined;
  let courseTimer: ReturnType<typeof setTimeout> | undefined;
  let respawnTimer: ReturnType<typeof setTimeout> | undefined;
  let self: Self | undefined;
  let dead = false;
  let lastHitMs = 0;
  let targetId: number | undefined;
  /** Names of the entities in view (a snapshot only sends them the first time). */
  const names = new Map<number, string>();
  /** The other players in view: feet positions, in tiles. */
  const players = new Map<number, { x: number; y: number }>();

  const send = (message: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(encodeMessage(message));
    }
  };
  const changeCourse = () => {
    wanderDir = Math.random() < PAUSE_CHANCE ? 0 : 1 + Math.floor(Math.random() * MAX_DIRECTION);
    courseTimer = setTimeout(changeCourse, randomBetween(WALK_MIN_MS, WALK_MAX_MS));
  };

  /** The player to attack among those in view: the nearest one that matches. */
  const findTarget = (from: Self): number | undefined => {
    let best: number | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [id, at] of players) {
      const playerName = names.get(id)?.toLowerCase();
      const wanted =
        playerName !== undefined &&
        (targetName !== undefined
          ? playerName === targetName
          : !playerName.startsWith(BOT_NAME_PREFIX));
      const distance = Math.hypot(at.x - from.x, at.y - from.y);
      if (wanted && distance < bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  };

  /** One client tick: chase and hit the target, or wander. */
  const tick = () => {
    if (dead || !self) {
      return;
    }
    const target = attacking ? findTarget(self) : undefined;
    if (target !== targetId) {
      targetId = target;
      if (target !== undefined) {
        process.stdout.write(`${name} attacks ${names.get(target)}\n`);
      }
    }
    const at = target !== undefined ? players.get(target) : undefined;
    if (!at) {
      send({ t: 'input', seq: seq++, dir: wanderDir });
      return;
    }
    const { dir, canHit } = steer(self, at.x - self.x, at.y - self.y);
    send({ t: 'input', seq: seq++, dir });
    const now = Date.now();
    if (canHit && now - lastHitMs >= COMBAT.unarmedCooldownMs + HIT_MARGIN_MS) {
      lastHitMs = now;
      send({ t: 'action', id: 'attack', target: { kind: 'self' } });
    }
  };

  socket.on('open', () => send({ t: 'hello', version: PROTOCOL_VERSION, devName: name }));
  socket.on('message', (data) => {
    const bytes = Array.isArray(data) ? Buffer.concat(data) : data;
    const message: ServerMessage = decodeServerMessage(new Uint8Array(bytes));
    if (message.t === 'welcome') {
      send({ t: 'viewport', ...(attacking ? ATTACKER_VIEW : BOT_VIEW) });
      changeCourse();
      inputTimer = setInterval(tick, NET.clientInputIntervalMs);
      process.stdout.write(`${name} joined\n`);
    } else if (message.t === 'rejected') {
      process.stdout.write(`${name} rejected: ${message.reason}\n`);
    } else if (message.t === 'snapshot') {
      self = message.you;
      for (const entity of message.entities) {
        if (entity.name !== undefined) {
          names.set(entity.id, entity.name);
        }
        if (entity.kind === 'player') {
          players.set(entity.id, { x: entity.x, y: entity.y });
        }
      }
      for (const id of message.gone ?? []) {
        names.delete(id);
        players.delete(id);
      }
    } else if (message.t === 'inventory' && attacking) {
      // Hits are bare-handed: hold nothing (a bot may have picked something up).
      if (message.slots[message.selected]) {
        const empty = message.slots.slice(0, INVENTORY.mainSlots).findIndex((slot) => !slot);
        if (empty >= 0) {
          send({ t: 'invSelect', slot: empty });
        }
      }
    } else if (message.t === 'vitals') {
      dead = message.dead !== undefined;
      if (dead && respawnTimer === undefined) {
        process.stdout.write(`${name} died (${message.dead})\n`);
        respawnTimer = setTimeout(() => {
          respawnTimer = undefined;
          send({ t: 'respawn' });
        }, RESPAWN_DELAY_MS);
      }
    }
  });
  socket.on('close', () => {
    clearInterval(inputTimer);
    clearTimeout(courseTimer);
    clearTimeout(respawnTimer);
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
