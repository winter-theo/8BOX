import { type Content, LAYER, tileSlotSchema } from '@8box/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { World } from '../world/World';

export interface DevRoutesOptions {
  world: World;
  content: Content;
}

const tileBodySchema = z.strictObject({
  /** Tile coordinates on the surface. */
  x: z.number().int(),
  y: z.number().int(),
  slot: tileSlotSchema,
  /** Tile id, or null to empty the slot. */
  tile: z.string().nullable(),
});

/**
 * Development routes, never registered in production. `POST /dev/tile` changes a tile of the surface,
 * to test saving and the `tileUpdate` sent to clients (the world saves it with the other changes).
 */
export async function devRoutes(app: FastifyInstance, { world, content }: DevRoutesOptions) {
  app.post('/dev/tile', async (request, reply) => {
    const parsed = tileBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: z.prettifyError(parsed.error) });
    }
    const { x, y, slot, tile } = parsed.data;
    if (!world.isInside(x, y)) {
      return reply.code(400).send({ error: `Tile (${x}, ${y}) is outside the world` });
    }
    if (tile !== null && content.tiles.get(tile)?.slot !== slot) {
      return reply.code(400).send({ error: `"${tile}" is not a tile of the "${slot}" slot` });
    }
    world.setTile(LAYER.surface, x, y, slot, tile);
    return { ok: true };
  });
}
