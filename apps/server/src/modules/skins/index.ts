import type { GameModule } from '../../core/module';

/**
 * The look of player characters: a player picks one of `PLAYER.skins` (`setSkin`, checked by its
 * schema), everyone who sees them gets it with the snapshots, and it is saved with the character.
 */
export const skinsModule: GameModule = {
  id: 'skins',
  dependsOn: ['players'],
  init(ctx) {
    ctx.net.onMessage('setSkin', (session, { skin }) => {
      const entity = session.player?.entity;
      if (entity === undefined || !ctx.entities.exists(entity)) {
        return;
      }
      ctx.entities.set(entity, 'skin', skin);
    });
  },
};
