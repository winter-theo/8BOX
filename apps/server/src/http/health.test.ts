import { PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('GET /health', () => {
  it('responds ok with the protocol version', async () => {
    const app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, protocol: PROTOCOL_VERSION });
    await app.close();
  });

  it('shows the tick time statistics of the running game', async () => {
    const app = buildApp({
      tickStats: () => ({ ticks: 120, avgMs: 0.123456, maxMs: 1.5, skippedTicks: 0 }),
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.json()).toEqual({
      ok: true,
      protocol: PROTOCOL_VERSION,
      tick: { count: 120, avgMs: 0.123, maxMs: 1.5, skipped: 0 },
    });
    await app.close();
  });
});
