import { PERSISTENCE } from '@8box/shared';
import type { SavedChunk } from '../world/chunkSerializer';
import type { GameStore, SavedCharacter } from './store';

interface WriteQueueOptions {
  store: Pick<GameStore, 'saveChunks' | 'saveCharacters'>;
  /** Called when a write fails; the data is kept and written again later. */
  onError: (error: unknown) => void;
  batchSize?: number;
  retryDelayMs?: number;
}

const chunkKey = (chunk: SavedChunk) => `${chunk.layer}:${chunk.cx}:${chunk.cy}`;
const characterKey = (character: SavedCharacter) => character.name.toLowerCase();

/**
 * Database writes, done outside the game loop: the game only queues data (synchronous), and the queue
 * writes it in the background, one batch at a time. A chunk or character queued again before being
 * written is written once, with its latest state. After an error, the data stays queued and the queue
 * tries again a little later.
 */
export class WriteQueue {
  private readonly chunks = new Map<string, SavedChunk>();
  private readonly characters = new Map<string, SavedCharacter>();
  private draining: Promise<void> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly batchSize: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: WriteQueueOptions) {
    this.batchSize = options.batchSize ?? PERSISTENCE.chunkWriteBatchSize;
    this.retryDelayMs = options.retryDelayMs ?? PERSISTENCE.writeRetryDelayMs;
  }

  /** Chunks and characters waiting to be written. */
  get pending(): number {
    return this.chunks.size + this.characters.size;
  }

  saveChunks(chunks: readonly SavedChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunkKey(chunk), chunk);
    }
    this.start();
  }

  saveCharacter(character: SavedCharacter): void {
    this.characters.set(characterKey(character), character);
    this.start();
  }

  /** Resolves once everything queued so far is written (or failed once): for the shutdown. */
  async flush(): Promise<void> {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.start();
    while (this.draining) {
      await this.draining;
    }
  }

  private start(): void {
    if (this.draining || this.retryTimer !== undefined || this.pending === 0) {
      return;
    }
    // Writing starts once the current code (the whole tick) is done: what it queues goes together.
    this.draining = Promise.resolve()
      .then(() => this.drain())
      .then((failed) => {
        this.draining = undefined;
        if (failed) {
          this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            this.start();
          }, this.retryDelayMs);
        } else {
          this.start(); // What was queued while writing.
        }
      });
  }

  /** Writes what is queued now; returns true when a write failed. */
  private async drain(): Promise<boolean> {
    const chunks = [...this.chunks.values()];
    const characters = [...this.characters.values()];
    this.chunks.clear();
    this.characters.clear();
    let failed = false;
    for (let i = 0; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize);
      try {
        await this.options.store.saveChunks(batch);
      } catch (error) {
        failed = true;
        this.options.onError(error);
        this.requeue(this.chunks, batch, chunkKey);
      }
    }
    if (characters.length > 0) {
      try {
        await this.options.store.saveCharacters(characters);
      } catch (error) {
        failed = true;
        this.options.onError(error);
        this.requeue(this.characters, characters, characterKey);
      }
    }
    return failed;
  }

  /** Puts failed data back, unless a newer state was queued meanwhile. */
  private requeue<T>(queue: Map<string, T>, items: readonly T[], key: (item: T) => string): void {
    for (const item of items) {
      if (!queue.has(key(item))) {
        queue.set(key(item), item);
      }
    }
  }
}
