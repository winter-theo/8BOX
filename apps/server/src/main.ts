import {
  baseContent,
  CONFIG,
  type Content,
  contentSizes,
  loadContent,
  parseSeed,
} from '@8box/shared';
import { pino } from 'pino';
import { Accounts } from './accounts/Accounts';
import { clerkIdentity } from './accounts/clerkIdentity';
import { Admin } from './admin/Admin';
import { buildApp } from './app';
import { WorldClock } from './core/clock';
import { createGame } from './core/game';
import { pgAccountStore } from './db/accounts.repo';
import { pgAdminStore } from './db/admin.repo';
import { type DatabaseConnection, openDatabase } from './db/database';
import { pgGameStore } from './db/pgStore';
import { pgReportStore } from './db/reports.repo';
import { env } from './env';
import { MODULES } from './modules';
import { saveEverything } from './modules/persistence';
import { Persistence } from './persistence/Persistence';
import { WriteQueue } from './persistence/writeQueue';
import { deserializeChunk } from './world/chunkSerializer';
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

let connection: DatabaseConnection;
try {
  connection = await openDatabase(env.DATABASE_URL);
} catch (error) {
  log.fatal(error, 'database unavailable (is it started? pnpm db:up)');
  process.exit(1);
}
const store = pgGameStore(connection);
const reports = pgReportStore(connection.db);

// Google sign-in through Clerk; without a key, only dev names can sign in.
if (env.CLERK_SECRET_KEY === undefined) {
  log.warn('CLERK_SECRET_KEY is unset: Google sign-in is off');
}
const accounts = new Accounts(
  pgAccountStore(connection.db),
  env.CLERK_SECRET_KEY === undefined
    ? undefined
    : clerkIdentity({
        secretKey: env.CLERK_SECRET_KEY,
        jwtKey: env.CLERK_JWT_KEY,
        authorizedParties: env.ALLOWED_ORIGINS,
      }),
  env.ADMIN_EMAILS,
);

// The world: its seed and its saved chunks; the missing chunks are generated, then saved.
const loadStart = performance.now();
let seed = await store.loadSeed();
if (seed === undefined) {
  seed = env.WORLD_SEED === undefined ? randomSeed() : parseSeed(env.WORLD_SEED);
  await store.saveSeed(seed);
  log.info({ seed }, 'new world');
}
const savedChunks = (await store.loadChunks()).map((saved) => {
  const { chunk, unknownIds } = deserializeChunk(saved, content);
  if (unknownIds.length > 0) {
    log.warn({ cx: chunk.cx, cy: chunk.cy, unknownIds }, 'saved tiles no longer exist: emptied');
  }
  return chunk;
});
const { world, generated } = World.load(
  { seed, content, layerSizeTiles: CONFIG.world.layerSizeTiles },
  savedChunks,
);
const writes = new WriteQueue({
  store,
  onError: (error) => log.error({ err: error }, 'save failed, will try again'),
});
const persistence = new Persistence(content, writes, await store.loadCharacters());
persistence.saveChunks(generated);
log.info(
  {
    seed,
    loadedChunks: savedChunks.length,
    generatedChunks: generated.length,
    ms: Math.round(performance.now() - loadStart),
  },
  'world loaded',
);

// Dev logins without an account are never allowed in production.
const devAuth = env.DEV_AUTH && env.NODE_ENV !== 'production';
if (env.DEV_AUTH && !devAuth) {
  log.warn('DEV_AUTH is ignored in production');
}

// World time goes on from where it was saved; TIME_SCALE (dev only) makes it run faster.
const timeScale = env.NODE_ENV === 'production' ? 1 : env.TIME_SCALE;
if (env.TIME_SCALE !== 1 && env.NODE_ENV === 'production') {
  log.warn('TIME_SCALE is ignored in production');
}
const clock = new WorldClock((await store.loadWorldTime()) ?? 0, timeScale);

const game = createGame({
  content,
  log: log.child({ scope: 'game' }),
  world,
  modules: MODULES,
  devAuth,
  persistence,
  accounts,
  reports,
  clock,
});

const app = buildApp({
  logger: log,
  allowedOrigins: env.ALLOWED_ORIGINS,
  net: game.ctx.net,
  tickStats: () => game.stats(),
  admin: {
    admin: new Admin({
      store: pgAdminStore(connection.db),
      reports,
      sessions: game.ctx.net,
      log: log.child({ scope: 'admin' }),
      auditListSize: CONFIG.admin.auditListSize,
      reportListSize: CONFIG.admin.reportListSize,
    }),
    accounts,
    devAuth,
  },
  // Development routes only: they change the world without any check.
  ...(env.NODE_ENV !== 'production' && { dev: { world, content } }),
});

/** Stops the game, writes what is not saved yet (waiting a little at most), then quits. */
async function shutDown(signal: string): Promise<void> {
  log.info({ signal }, 'shutting down');
  game.stop();
  saveEverything(game.ctx);
  const timeout = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), CONFIG.persistence.shutdownFlushTimeoutMs).unref();
  });
  if ((await Promise.race([persistence.flush(), timeout])) === 'timeout') {
    log.error({ pending: writes.pending }, 'shutdown: some data could not be saved');
  }
  await store.close();
  await app.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutDown(signal).then(
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
