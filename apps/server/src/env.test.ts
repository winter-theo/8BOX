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
    });
  });

  it('splits and trims the allowed origins', () => {
    const env = parseEnv({ ALLOWED_ORIGINS: 'http://a.test, http://b.test,' });
    expect(env.ALLOWED_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('rejects an invalid port', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
