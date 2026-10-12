import { describe, expect, it } from 'vitest';
import type { SavedChunk } from '../world/chunkSerializer';
import type { SavedCharacter } from './store';
import { WriteQueue } from './writeQueue';

/** A saved chunk at (cx, 0) whose `palette` tells its version. */
const chunk = (cx: number, version = 1): SavedChunk => ({
  layer: 0,
  cx,
  cy: 0,
  palette: ['', `v${version}`],
  data: new Uint8Array(),
  meta: [],
});
const label = (saved: SavedChunk) => `${saved.cx}:${saved.palette[1]}`;

/** A store that records each write, can be held, and fails when told to. */
function fakeStore() {
  const writes: string[][] = [];
  const characters: string[][] = [];
  let failNext = 0;
  let hold: Promise<void> | undefined;
  let release = () => {};
  return {
    writes,
    characters,
    failNextWrites(count: number) {
      failNext = count;
    },
    holdWrites() {
      hold = new Promise((resolve) => {
        release = () => {
          hold = undefined;
          resolve();
        };
      });
    },
    release: () => release(),
    store: {
      async saveChunks(batch: readonly SavedChunk[]) {
        await hold;
        if (failNext > 0) {
          failNext--;
          throw new Error('database down');
        }
        writes.push(batch.map(label));
      },
      async saveCharacters(batch: readonly SavedCharacter[]) {
        characters.push(batch.map((c) => `${c.playerId}@${c.x}`));
      },
    },
  };
}

function setup(batchSize = 100) {
  const fake = fakeStore();
  const errors: unknown[] = [];
  const queue = new WriteQueue({
    store: fake.store,
    onError: (error) => errors.push(error),
    batchSize,
    retryDelayMs: 60_000,
  });
  return { ...fake, queue, errors };
}

describe('WriteQueue', () => {
  it('writes the chunks queued together in one batch, each once with its latest state', async () => {
    const { queue, writes } = setup();

    queue.saveChunks([chunk(1), chunk(2)]);
    queue.saveChunks([chunk(1, 2)]);
    expect(writes).toEqual([]); // Nothing written during the tick.
    await queue.flush();

    expect(writes).toEqual([['1:v2', '2:v1']]);
    expect(queue.pending).toBe(0);
  });

  it('merges what is queued while a write is running into the next write', async () => {
    const { queue, writes, holdWrites, release } = setup();
    holdWrites();
    queue.saveChunks([chunk(1)]);
    await Promise.resolve(); // The write of chunk 1 starts and waits.
    await Promise.resolve();

    queue.saveChunks([chunk(1, 2)]);
    queue.saveChunks([chunk(1, 3), chunk(2)]);
    release();
    await queue.flush();

    expect(writes).toEqual([['1:v1'], ['1:v3', '2:v1']]);
  });

  it('writes many chunks in batches', async () => {
    const { queue, writes } = setup(2);

    queue.saveChunks([1, 2, 3, 4, 5].map((cx) => chunk(cx)));
    await queue.flush();

    expect(writes.map((batch) => batch.length)).toEqual([2, 2, 1]);
  });

  it('keeps the data after a database error and writes it on the next try', async () => {
    const { queue, writes, errors, failNextWrites } = setup();
    failNextWrites(1);

    queue.saveChunks([chunk(1)]);
    await queue.flush();
    expect(errors).toHaveLength(1);
    expect(queue.pending).toBe(1);

    await queue.flush(); // The shutdown, or the retry after the delay.
    expect(writes).toEqual([['1:v1']]);
    expect(queue.pending).toBe(0);
  });

  it('does not put back failed data over a newer state', async () => {
    const { queue, writes, failNextWrites, holdWrites, release } = setup();
    failNextWrites(1);
    holdWrites();
    queue.saveChunks([chunk(1)]);
    await Promise.resolve();
    await Promise.resolve();
    queue.saveChunks([chunk(1, 2)]); // Queued while the failing write runs.
    release();

    await queue.flush();
    await queue.flush();

    expect(writes.flat()).toEqual(['1:v2']);
  });

  it('writes each character once, with its latest position', async () => {
    const { queue, characters } = setup();

    queue.saveCharacter({ playerId: 1, layer: 0, x: 1, y: 1 });
    queue.saveCharacter({ playerId: 1, layer: 0, x: 2, y: 1 });
    queue.saveCharacter({ playerId: 2, layer: 0, x: 5, y: 5 });
    await queue.flush();

    expect(characters).toEqual([['1@2', '2@5']]);
  });
});
