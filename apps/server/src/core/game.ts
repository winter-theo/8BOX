import { CONFIG, type Content, type GameConfig } from '@8box/shared';
import { Accounts } from '../accounts/Accounts';
import { MemoryAccountStore } from '../accounts/account';
import { NetServer } from '../net/net';
import { Persistence } from '../persistence/Persistence';
import { MemoryStore } from '../persistence/store';
import { WriteQueue } from '../persistence/writeQueue';
import type { World } from '../world/World';
import { EntityStore } from './entities';
import { createEventBus } from './events';
import { GameLoop, type TickStats } from './loop';
import {
  type GameModule,
  initModules,
  type Logger,
  type ServerContext,
  SystemRegistry,
} from './module';
import { Scheduler } from './scheduler';

export interface ContextOptions {
  config: GameConfig;
  content: Content;
  log: Logger;
  world: World;
  /** Accept dev logins (`hello { devName }`). Default: false. */
  devAuth?: boolean;
  /** Clock of the network layer, in ms (default: performance.now). */
  now?: () => number;
  /** Saves (default: kept in memory, for tests). */
  persistence?: Persistence;
  /** Sign-in (default: dev accounts kept in memory, no Clerk). */
  accounts?: Accounts;
}

/** Saves kept in memory: nothing outlives the process (tests). */
export function memoryPersistence(content: Content, log: Logger): Persistence {
  const writes = new WriteQueue({
    store: new MemoryStore(),
    onError: (error) => log.error({ err: error }, 'save failed'),
  });
  return new Persistence(content, writes);
}

/** Duration of a tick, in ms. */
export function tickMs(config: GameConfig): number {
  return 1000 / config.net.tickRateHz;
}

export function createContext({
  config,
  content,
  log,
  world,
  devAuth = false,
  now,
  persistence = memoryPersistence(content, log),
  accounts = new Accounts(new MemoryAccountStore(), undefined, []),
}: ContextOptions): ServerContext {
  const events = createEventBus();
  world.onChange((change) => events.emit('tile.changed', change));
  const scheduler = new Scheduler({
    tickMs: tickMs(config),
    onError: (error, task) => log.error({ err: error, task }, 'scheduled task failed'),
  });
  return {
    config,
    content,
    log,
    events,
    scheduler,
    entities: new EntityStore(events),
    systems: new SystemRegistry(),
    world,
    net: new NetServer({
      config,
      log,
      events,
      scheduler,
      accounts,
      devAuth,
      ...(now && { now }),
    }),
    persistence,
  };
}

/** One game tick: the scheduled tasks that are due, then every system by phase. */
export function runTick(ctx: ServerContext, tick: number): void {
  ctx.scheduler.runTick(tick);
  ctx.systems.run(ctx, tickMs(ctx.config) / 1000);
}

export interface GameOptions {
  content: Content;
  log: Logger;
  world: World;
  modules: readonly GameModule[];
  config?: GameConfig;
  devAuth?: boolean;
  persistence?: Persistence;
  accounts?: Accounts;
}

export interface Game {
  readonly ctx: ServerContext;
  start(): void;
  stop(): void;
  stats(): TickStats;
}

/** Builds the server context, initializes the modules and prepares the fixed-step loop. */
export function createGame({
  content,
  log,
  world,
  modules,
  config = CONFIG,
  devAuth = false,
  persistence,
  accounts,
}: GameOptions): Game {
  const ctx = createContext({
    config,
    content,
    log,
    world,
    devAuth,
    ...(persistence && { persistence }),
    ...(accounts && { accounts }),
  });
  const order = initModules(ctx, modules);
  log.info({ modules: order, devAuth }, 'modules initialized');

  const loop = new GameLoop({
    tickMs: tickMs(config),
    maxCatchUpTicks: config.loop.maxCatchUpTicks,
    statsWindowTicks: config.loop.statsWindowTicks,
    onTick: (tick) => runTick(ctx, tick),
    onError: (error, tick) => log.error({ err: error, tick }, 'tick failed'),
  });

  return {
    ctx,
    start: () => loop.start(),
    stop: () => loop.stop(),
    stats: () => loop.stats(),
  };
}
