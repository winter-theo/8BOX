import {
  baseContent,
  CONFIG,
  type Content,
  contentSizes,
  loadContent,
  parseSeed,
} from '@8box/shared';
import { pino } from 'pino';
import { buildApp } from './app';
import { createGame } from './core/game';
import { env } from './env';
import { MODULES } from './modules';
import { randomSeed } from './world/seed';
import { World } from './world/World';

const log = pino({ level: env.LOG_LEVEL });

let content: Content;
try {
  content = loadContent(baseContent);
} catch (error) {
  // A ContentError lists every problem with its file, id and field.
  log.fatal(error, 'invalid game content');
  process.exit(1);
}
log.info(contentSizes(content), 'content loaded');

const seed = env.WORLD_SEED === undefined ? randomSeed() : parseSeed(env.WORLD_SEED);
const generationStart = performance.now();
const world = World.generate({ seed, content, layerSizeTiles: CONFIG.world.layerSizeTiles });
log.info(
  {
    seed,
    chunks: world.chunkCount,
    ms: Math.round(performance.now() - generationStart),
  },
  'world generated',
);

// Dev logins without an account are never allowed in production.
const devAuth = env.DEV_AUTH && env.NODE_ENV !== 'production';
if (env.DEV_AUTH && !devAuth) {
  log.warn('DEV_AUTH is ignored in production');
}

const game = createGame({
  content,
  log: log.child({ scope: 'game' }),
  world,
  modules: MODULES,
  devAuth,
});

const app = buildApp({
  logger: log,
  allowedOrigins: env.ALLOWED_ORIGINS,
  net: game.ctx.net,
  tickStats: () => game.stats(),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'shutting down');
    game.stop();
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        log.error(error, 'shutdown failed');
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  log.error(error, 'failed to start');
  process.exit(1);
}

game.start();
log.info({ tickRateHz: game.ctx.config.net.tickRateHz }, 'game loop started');
