import { z } from 'zod';

/** The database of `docker-compose.yml` (`pnpm db:up`), used when DATABASE_URL is unset outside production. */
const DEV_DATABASE_URL = 'postgres://8box:8box@localhost:5432/8box';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Interface the HTTP server listens on. */
    HOST: z.string().min(1).default('localhost'),
    /** TCP port of the HTTP and WebSocket server. */
    PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Comma-separated browser origins allowed to open a WebSocket. */
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),
    /** Seed of a new world: a number or any text, random when unset. An existing world keeps its own. */
    WORLD_SEED: z.string().trim().min(1).optional(),
    /** `1` accepts dev logins (`hello { devName }`, no account). Always ignored in production. */
    DEV_AUTH: z
      .enum(['0', '1'])
      .default('0')
      .transform((value) => value === '1'),
    /** PostgreSQL connection URL. Required in production. */
    DATABASE_URL: z.string().min(1).optional(),
  })
  .transform((env, ctx) => {
    if (env.DATABASE_URL === undefined && env.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required in production' });
      return z.NEVER;
    }
    return { ...env, DATABASE_URL: env.DATABASE_URL ?? DEV_DATABASE_URL };
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
