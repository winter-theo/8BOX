import type { GameStore } from '../persistence/store';
import { readCharacters, writeCharacters } from './characters.repo';
import { readChunks, writeChunks } from './chunks.repo';
import type { DatabaseConnection } from './database';
import { readSeed, writeSeed } from './worldState.repo';

/** The game store in PostgreSQL. */
export function pgGameStore({ db, close }: DatabaseConnection): GameStore {
  return {
    loadSeed: () => readSeed(db),
    saveSeed: (seed) => writeSeed(db, seed),
    loadChunks: () => readChunks(db),
    saveChunks: (chunks) => writeChunks(db, chunks),
    loadCharacters: () => readCharacters(db),
    saveCharacters: (characters) => writeCharacters(db, characters),
    close,
  };
}
