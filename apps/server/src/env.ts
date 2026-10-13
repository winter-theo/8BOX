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
    /** Dev: world time runs this many times faster than real time (60: a day lasts 1 min). */
    TIME_SCALE: z.coerce.number().positive().max(10_000).default(1),
    /** PostgreSQL connection URL. Required in production. */
    DATABASE_URL: z.string().min(1).optional(),
    /** Clerk secret key (sk_…): checks the players' session tokens. Required in production. */
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    /** Clerk PEM public key: checks tokens without a network call (optional). */
    CLERK_JWT_KEY: z.string().min(1).optional(),
    /** Comma-separated emails of the admins: approved at once, with the admin role. */
    ADMIN_EMAILS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((email) => email.trim())
          .filter((email) => email.length > 0),
      ),
  })
  .transform((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const key of ['DATABASE_URL', 'CLERK_SECRET_KEY'] as const) {
        if (env[key] === undefined) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
        }
      }
      if (env.DATABASE_URL === undefined || env.CLERK_SECRET_KEY === undefined) {
        return z.NEVER;
      }
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
