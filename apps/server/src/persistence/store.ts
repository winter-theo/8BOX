import type { SavedChunk } from '../world/chunkSerializer';

/** Where the character of a player (`players.id`) was when last saved. */
export interface SavedCharacter {
  playerId: number;
  layer: number;
  /** Feet position, in tiles. */
  x: number;
  y: number;
}

/**
 * What the game keeps between runs: the database, or memory in tests. Reads happen at startup; writes
 * go through the `WriteQueue`, never from the game loop.
 */
export interface GameStore {
  /** Seed of the existing world; undefined for a new one. */
  loadSeed(): Promise<number | undefined>;
  saveSeed(seed: number): Promise<void>;
  loadChunks(): Promise<SavedChunk[]>;
  saveChunks(chunks: readonly SavedChunk[]): Promise<void>;
  loadCharacters(): Promise<SavedCharacter[]>;
  saveCharacters(characters: readonly SavedCharacter[]): Promise<void>;
  close(): Promise<void>;
}

/** A store kept in memory: for tests, and to run without a database. */
export class MemoryStore implements GameStore {
  seed: number | undefined;
  readonly chunks = new Map<string, SavedChunk>();
  readonly characters = new Map<number, SavedCharacter>();

  async loadSeed() {
    return this.seed;
  }

  async saveSeed(seed: number) {
    this.seed = seed;
  }

  async loadChunks() {
    return [...this.chunks.values()];
  }

  async saveChunks(chunks: readonly SavedChunk[]) {
    for (const chunk of chunks) {
      this.chunks.set(`${chunk.layer}:${chunk.cx}:${chunk.cy}`, chunk);
    }
  }

  async loadCharacters() {
    return [...this.characters.values()];
  }

  async saveCharacters(characters: readonly SavedCharacter[]) {
    for (const character of characters) {
      this.characters.set(character.playerId, character);
    }
  }

  async close() {}
}
