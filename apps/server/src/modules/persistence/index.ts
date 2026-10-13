import type { GameModule, ServerContext } from '../../core/module';
import { characterToSave } from '../../persistence/characterToSave';

/** Queues the save of every player character: where it stands now, how it looks, what it carries. */
function saveCharacters(ctx: ServerContext): void {
  for (const entity of ctx.entities.query('player', 'position')) {
    const character = characterToSave(ctx, entity);
    if (character) {
      ctx.persistence.saveCharacter(character);
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
