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
      WORLD_SEED: undefined,
      DATABASE_URL: 'postgres://8box:8box@localhost:5432/8box',
    });
  });

  it('requires DATABASE_URL in production only', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    const url = 'postgres://game:secret@db:5432/game';
    expect(parseEnv({ NODE_ENV: 'production', DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it('splits and trims the allowed origins', () => {
    const env = parseEnv({ ALLOWED_ORIGINS: 'http://a.test, http://b.test,' });
    expect(env.ALLOWED_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('rejects an invalid port', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('reads DEV_AUTH as a 0/1 flag', () => {
    expect(parseEnv({ DEV_AUTH: '1' }).DEV_AUTH).toBe(true);
    expect(parseEnv({ DEV_AUTH: '0' }).DEV_AUTH).toBe(false);
    expect(() => parseEnv({ DEV_AUTH: 'yes' })).toThrow(/DEV_AUTH/);
  });
});
