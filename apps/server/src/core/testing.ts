import { baseContent, CONFIG, type Content, type GameConfig, loadContent } from '@8box/shared';
import { pino } from 'pino';
import { createContext, runTick } from './game';
import { type GameModule, initModules, type ServerContext } from './module';

export interface TestContextOptions {
  /** Default: the real config. */
  config?: GameConfig;
  /** Default: the base content. */
  content?: Content;
  /** Modules to initialize, in dependency order. */
  modules?: readonly GameModule[];
}

export interface TestContext {
  ctx: ServerContext;
  /** Runs `count` ticks by hand: due scheduled tasks, then the systems. */
  tick(count?: number): void;
}

/** Server context for tests: real core services, no network, no database, silent logs. */
export function createTestContext(options: TestContextOptions = {}): TestContext {
  const ctx = createContext({
    config: options.config ?? CONFIG,
    content: options.content ?? loadContent(baseContent),
    log: pino({ level: 'silent' }),
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
