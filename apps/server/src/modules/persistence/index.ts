import type { GameModule, ServerContext } from '../../core/module';

/** Queues the save of every player character, where it stands now. */
function saveCharacters(ctx: ServerContext): void {
  for (const entity of ctx.entities.query('player', 'position')) {
    const player = ctx.entities.get(entity, 'player');
    const position = ctx.entities.get(entity, 'position');
    if (player && position) {
      ctx.persistence.saveCharacter({ name: player.name, ...position });
    }
  }
}

/**
 * Queues everything not saved yet: the modified chunks and the characters. Called on the shutdown,
 * once the game loop has stopped.
 */
export function saveEverything(ctx: ServerContext): void {
  ctx.persistence.saveChunks(ctx.world.takeDirtyChunks());
  saveCharacters(ctx);
}

/**
 * Saves the world as it changes: the modified chunks every 30 s, the characters every 60 s (and when
 * their player leaves, see the players module). Only queues: the database writes happen outside ticks.
 */
export const persistenceModule: GameModule = {
  id: 'persistence',
  init(ctx) {
    const { chunkSaveIntervalMs, characterSaveIntervalMs } = ctx.config.persistence;
    ctx.scheduler.every(
      chunkSaveIntervalMs,
      () => ctx.persistence.saveChunks(ctx.world.takeDirtyChunks()),
      'save modified chunks',
    );
    ctx.scheduler.every(characterSaveIntervalMs, () => saveCharacters(ctx), 'save characters');
  },
};
