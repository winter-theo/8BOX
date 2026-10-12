import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('GET /health', () => {
  const app = buildApp();
  afterAll(() => app.close());

  it('responds ok with the protocol version', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, protocol: 1 });
  });
});
