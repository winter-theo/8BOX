import { CONFIG, type Content, type GameConfig } from '@8box/shared';
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
}

/** Duration of a tick, in ms. */
export function tickMs(config: GameConfig): number {
  return 1000 / config.net.tickRateHz;
}

export function createContext({ config, content, log }: ContextOptions): ServerContext {
  const events = createEventBus();
  return {
    config,
    content,
    log,
    events,
    entities: new EntityStore(events),
    scheduler: new Scheduler({
      tickMs: tickMs(config),
      onError: (error, task) => log.error({ err: error, task }, 'scheduled task failed'),
    }),
    systems: new SystemRegistry(),
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
  modules: readonly GameModule[];
  config?: GameConfig;
}

export interface Game {
  readonly ctx: ServerContext;
  start(): void;
  stop(): void;
  stats(): TickStats;
}

/** Builds the server context, initializes the modules and prepares the fixed-step loop. */
export function createGame({ content, log, modules, config = CONFIG }: GameOptions): Game {
  const ctx = createContext({ config, content, log });
  const order = initModules(ctx, modules);
  log.info({ modules: order }, 'modules initialized');

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
