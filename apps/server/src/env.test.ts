import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('applies development defaults', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      HOST: 'localhost',
      PORT: 3000,
      LOG_LEVEL: 'info',
      ALLOWED_ORIGINS: ['http://localhost:5173'],
      DEV_AUTH: false,
      TIME_SCALE: 1,
      WORLD_SEED: undefined,
      DATABASE_URL: 'postgres://8box:8box@localhost:5432/8box',
      ADMIN_EMAILS: [],
      CLERK_SECRET_KEY: undefined,
      CLERK_JWT_KEY: undefined,
    });
  });

  it('reads the admin emails as a list', () => {
    expect(parseEnv({ ADMIN_EMAILS: ' a@b.test, c@d.test ,' }).ADMIN_EMAILS).toEqual([
      'a@b.test',
      'c@d.test',
    ]);
  });

  it('requires DATABASE_URL and CLERK_SECRET_KEY in production only', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' })).toThrow(
      /CLERK_SECRET_KEY/,
    );
    const url = 'postgres://game:secret@db:5432/game';
    const env = parseEnv({ NODE_ENV: 'production', DATABASE_URL: url, CLERK_SECRET_KEY: 'sk_x' });
    expect(env.DATABASE_URL).toBe(url);
  });

  it('splits and trims the allowed origins', () => {
    const env = parseEnv({ ALLOWED_ORIGINS: 'http://a.test, http://b.test,' });
    expect(env.ALLOWED_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('rejects an invalid port', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('reads TIME_SCALE as a positive number', () => {
    expect(parseEnv({ TIME_SCALE: '60' }).TIME_SCALE).toBe(60);
    expect(() => parseEnv({ TIME_SCALE: '0' })).toThrow(/TIME_SCALE/);
  });

  it('reads DEV_AUTH as a 0/1 flag', () => {
    expect(parseEnv({ DEV_AUTH: '1' }).DEV_AUTH).toBe(true);
    expect(parseEnv({ DEV_AUTH: '0' }).DEV_AUTH).toBe(false);
    expect(() => parseEnv({ DEV_AUTH: 'yes' })).toThrow(/DEV_AUTH/);
  });
});
