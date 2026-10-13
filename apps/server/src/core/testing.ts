import {
  type ActionDef,
  baseContent,
  type ClientMessage,
  CONFIG,
  type Content,
  decodeServerMessage,
  encodeMessage,
  type GameConfig,
  loadContent,
  type ServerMessage,
} from '@8box/shared';
import { pino } from 'pino';
import type { Accounts } from '../accounts/Accounts';
import type { Session, Transport } from '../net/session';
import type { Persistence } from '../persistence/Persistence';
import type { ReportStore } from '../reports/store';
import { World } from '../world/World';
import { createContext, runTick } from './game';
import { type GameModule, initModules, type ServerContext } from './module';

/** Side of the default test world, in tiles: 2 × 2 chunks, quick to generate. */
const TEST_WORLD_SIZE_TILES = 64;
const TEST_WORLD_SEED = 1;

export interface TestContextOptions {
  /** Default: the real config. */
  config?: GameConfig;
  /** Default: the base content. */
  content?: Content;
  /** Default: a small generated world (64 × 64 tiles). */
  world?: World;
  /** Modules to initialize, in dependency order. */
  modules?: readonly GameModule[];
  /** Accept dev logins. Default: false. */
  devAuth?: boolean;
  /** Network clock, in ms (rate limits, latency). Default: performance.now. */
  now?: () => number;
  /** Saves. Default: kept in memory. */
  persistence?: Persistence;
  /** Sign-in. Default: dev accounts in memory, no Clerk. */
  accounts?: Accounts;
  /** Reports. Default: in memory, over the default accounts. */
  reports?: ReportStore;
  /** Definitions of the actions. Default: those of the base game. */
  actions?: readonly ActionDef[];
}

export interface TestContext {
  ctx: ServerContext;
  /** Runs `count` ticks by hand: due scheduled tasks, then the systems. */
  tick(count?: number): void;
}

/** Server context for tests: real core services, no network, no database, silent logs. */
export function createTestContext(options: TestContextOptions = {}): TestContext {
  const content = options.content ?? loadContent(baseContent);
  const world =
    options.world ??
    World.generate({ seed: TEST_WORLD_SEED, content, layerSizeTiles: TEST_WORLD_SIZE_TILES });
  const ctx = createContext({
    config: options.config ?? CONFIG,
    content,
    world,
    log: pino({ level: 'silent' }),
    devAuth: options.devAuth ?? false,
    ...(options.now && { now: options.now }),
    ...(options.persistence && { persistence: options.persistence }),
    ...(options.accounts && { accounts: options.accounts }),
    ...(options.reports && { reports: options.reports }),
    ...(options.actions && { actions: options.actions }),
  });
  initModules(ctx, options.modules ?? []);

  let currentTick = 0;
  return {
    ctx,
    tick(count = 1) {
      for (let i = 0; i < count; i++) {
        currentTick++;
        runTick(ctx, currentTick);
      }
    },
  };
}

export interface FakeClient {
  session: Session;
  /** Messages the server sent to this client, decoded. */
  received: ServerMessage[];
  /** Set once the server closed the connection. */
  closed: { code: number; reason: string } | undefined;
  /** Heartbeat pings received. */
  pings: number;
  send(message: ClientMessage): void;
  sendRaw(data: Uint8Array, isBinary?: boolean): void;
  last(): ServerMessage | undefined;
}

/** Connects a fake client to the context's network layer (no socket). */
export function connectFakeClient(ctx: ServerContext): FakeClient {
  const transport: Transport = {
    send: (data) => client.received.push(decodeServerMessage(data)),
    close: (code, reason) => {
      client.closed = { code, reason };
    },
    ping: () => {
      client.pings++;
    },
  };
  const client: FakeClient = {
    session: undefined as unknown as Session,
    received: [],
    closed: undefined,
    pings: 0,
    send: (message) => ctx.net.receive(client.session, encodeMessage(message)),
    sendRaw: (data, isBinary = true) => ctx.net.receive(client.session, data, isBinary),
    last: () => client.received.at(-1),
  };
  client.session = ctx.net.connect(transport);
  return client;
}

/** Lets pending promises finish (sign-in, saves): what a real server does between two messages. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
