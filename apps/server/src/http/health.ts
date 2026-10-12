import { PROTOCOL_VERSION } from '@8box/shared';
import type { FastifyInstance } from 'fastify';
import type { TickStats } from '../core/loop';

export interface HealthOptions {
  tickStats?: (() => TickStats) | undefined;
}

/** Rounds a duration to the microsecond, in ms. */
function roundMs(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

export async function healthRoutes(app: FastifyInstance, options: HealthOptions): Promise<void> {
  app.get('/health', async () => {
    const stats = options.tickStats?.();
    return {
      ok: true,
      protocol: PROTOCOL_VERSION,
      ...(stats && {
        tick: {
          count: stats.ticks,
          avgMs: roundMs(stats.avgMs),
          maxMs: roundMs(stats.maxMs),
          skipped: stats.skippedTicks,
        },
      }),
    };
  });
}
