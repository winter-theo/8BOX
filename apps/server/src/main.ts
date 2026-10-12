import { buildApp } from './app';
import { env } from './env';

const app = buildApp({
  logger: { level: env.LOG_LEVEL },
  allowedOrigins: env.ALLOWED_ORIGINS,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error(error, 'shutdown failed');
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error, 'failed to start');
  process.exit(1);
}
