import { LAYER } from '@8box/shared';
import type { Position } from '../../core/entities';
import type { GameModule } from '../../core/module';
import type { World } from '../../world/World';

/** Where new players appear: the spawn clearing of the surface. */
export function spawnPosition(world: World): Position {
  return { layer: LAYER.surface, x: world.spawn.x, y: world.spawn.y };
}

/** Turns authenticated sessions into player entities, and removes them when the session ends. */
export const playersModule: GameModule = {
  id: 'players',
  init(ctx) {
    ctx.events.on('session.authenticated', ({ session }) => {
      const name = session.name;
      if (name === undefined) {
        return;
      }
      const entity = ctx.entities.create('player', {
        position: spawnPosition(ctx.world),
        player: { name },
      });
      session.player = { entity, name };
      ctx.log.info({ name, entity, session: session.id }, 'player joined');
      ctx.events.emit('player.joined', { entity, name });
    });

    ctx.events.on('session.closed', ({ session, reason }) => {
      const player = session.player;
      if (!player) {
        return;
      }
      ctx.entities.remove(player.entity);
      ctx.log.info(
        { name: player.name, entity: player.entity, reason, latencyMs: session.latencyMs },
        'player left',
      );
      ctx.events.emit('player.left', { entity: player.entity, name: player.name, reason });
    });
  },
};
