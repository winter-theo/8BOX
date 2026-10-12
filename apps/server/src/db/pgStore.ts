import type { GameStore } from '../persistence/store';
import { readCharacters, writeCharacters } from './characters.repo';
import { readChunks, writeChunks } from './chunks.repo';
import { openDatabase } from './database';
import { readSeed, writeSeed } from './worldState.repo';

/** The game store in PostgreSQL; the migrations are applied when it opens. */
export async function openPgStore(url: string): Promise<GameStore> {
  const { db, close } = await openDatabase(url);
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
