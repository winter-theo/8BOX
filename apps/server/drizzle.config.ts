import { defineConfig } from 'drizzle-kit';

/** `pnpm db:generate` writes SQL migrations from the schema; the server applies them when it starts. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://8box:8box@localhost:5432/8box',
  },
});
