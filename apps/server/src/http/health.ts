import { PROTOCOL_VERSION } from '@8box/shared';
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ ok: true, protocol: PROTOCOL_VERSION }));
}
