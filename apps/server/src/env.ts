import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Interface the HTTP server listens on. */
  HOST: z.string().min(1).default('localhost'),
  /** TCP port of the HTTP and WebSocket server. */
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
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
  /** World seed: a number or any text. Random when unset (stored in the database from step 10). */
  WORLD_SEED: z.string().trim().min(1).optional(),
  /** `1` accepts dev logins (`hello { devName }`, no account). Always ignored in production. */
  DEV_AUTH: z
    .enum(['0', '1'])
    .default('0')
    .transform((value) => value === '1'),
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
