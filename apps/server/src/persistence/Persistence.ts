import type { Chunk, Content } from '@8box/shared';
import { serializeChunk } from '../world/chunkSerializer';
import type { SavedCharacter } from './store';
import type { WriteQueue } from './writeQueue';

/**
 * What the game saves, without ever waiting: characters are kept in memory (loaded at startup) and every
 * save is queued for the background `WriteQueue`.
 */
export class Persistence {
  private readonly characters = new Map<number, SavedCharacter>();

  constructor(
    private readonly content: Content,
    private readonly writes: WriteQueue,
    characters: readonly SavedCharacter[] = [],
  ) {
    for (const character of characters) {
      this.characters.set(character.playerId, character);
    }
  }

  /** The saved character of a player (`players.id`). */
  character(playerId: number): SavedCharacter | undefined {
    return this.characters.get(playerId);
  }

  saveCharacter(character: SavedCharacter): void {
    this.characters.set(character.playerId, character);
    this.writes.saveCharacter(character);
  }

  saveChunks(chunks: readonly Chunk[]): void {
    if (chunks.length > 0) {
      this.writes.saveChunks(chunks.map((chunk) => serializeChunk(chunk, this.content)));
    }
  }

  /** The world clock, in ms of world time. */
  saveWorldTime(worldTimeMs: number): void {
    this.writes.saveWorldTime(worldTimeMs);
  }

  /** Resolves once everything saved so far is written: for the shutdown. */
  flush(): Promise<void> {
    return this.writes.flush();
  }
}
