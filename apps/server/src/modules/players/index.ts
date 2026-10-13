import { DEFAULT_SKIN, LAYER } from '@8box/shared';
import type { Position } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import { characterToSave } from '../../persistence/characterToSave';
import type { World } from '../../world/World';

/** Where new players appear: the spawn clearing of the surface. */
export function spawnPosition(world: World): Position {
  return { layer: LAYER.surface, x: world.spawn.x, y: world.spawn.y };
}

/** Where the player's character was saved, when it is still a place of the world. */
function savedPosition(ctx: ServerContext, playerId: number): Position | undefined {
  const saved = ctx.persistence.character(playerId);
  if (!saved || saved.layer !== LAYER.surface || !ctx.world.isInside(saved.x, saved.y)) {
    return undefined;
  }
  return { layer: saved.layer, x: saved.x, y: saved.y };
}

/**
 * Turns authenticated sessions into player entities, and removes them when the session ends. A player
 * comes back where their character was saved (on leaving, and every 60 s by the persistence module),
 * with its skin (and its inventory, given by the inventory module); a new player starts at the spawn
 * with the default skin.
 */
export const playersModule: GameModule = {
  id: 'players',
  init(ctx) {
    ctx.events.on('session.authenticated', ({ session }) => {
      const name = session.name;
      const playerId = session.account?.playerId;
      if (name === undefined || playerId === undefined) {
        return;
      }
      const position = savedPosition(ctx, playerId) ?? spawnPosition(ctx.world);
      const skin = ctx.persistence.character(playerId)?.skin ?? DEFAULT_SKIN;
      const entity = ctx.entities.create('player', {
        position,
        player: { name, playerId },
        facing: 'down',
        skin,
      });
      session.player = { entity, name, skin, position: { ...position } };
      ctx.log.info({ name, entity, session: session.id }, 'player joined');
      ctx.events.emit('player.joined', { entity, name });
    });

    ctx.events.on('session.closed', ({ session, reason }) => {
      const player = session.player;
      if (!player) {
        return;
      }
      const character = characterToSave(ctx, player.entity);
      if (character) {
        ctx.persistence.saveCharacter(character);
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
