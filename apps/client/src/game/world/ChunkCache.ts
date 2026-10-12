import {
  type Chunk,
  type ChunkMessage,
  type Content,
  chunkCoord,
  decodeChunk,
  EMPTY_TILE,
  localCoord,
  type TileDef,
  type TileSlot,
  type TileUpdateMessage,
  tileCode,
  tileIndex,
  tileOfCode,
} from '@8box/shared';
import type { ClientEventBus } from '../events';

const key = (layer: number, cx: number, cy: number) => `${layer}:${cx}:${cy}`;

/** The chunks the server streams to this client, with local tile codes. */
export class ChunkCache {
  private readonly chunks = new Map<string, Chunk>();

  constructor(
    private readonly content: Content,
    private readonly bus: ClientEventBus,
  ) {}

  get size(): number {
    return this.chunks.size;
  }

  all(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  get(layer: number, cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(key(layer, cx, cy));
  }

  /** Tile in a slot of tile (x, y); undefined when empty or not loaded. */
  getTile(layer: number, x: number, y: number, slot: TileSlot): TileDef | undefined {
    const chunk = this.get(layer, chunkCoord(x), chunkCoord(y));
    const code = chunk?.slot(slot)[tileIndex(localCoord(x), localCoord(y))] ?? EMPTY_TILE;
    return tileOfCode(this.content, code);
  }

  load(message: ChunkMessage): void {
    const chunk = decodeChunk(message, this.content);
    this.chunks.set(key(chunk.layer, chunk.cx, chunk.cy), chunk);
    this.bus.emit('chunk.loaded', { chunk });
  }

  unload(layer: number, cx: number, cy: number): void {
    if (this.chunks.delete(key(layer, cx, cy))) {
      this.bus.emit('chunk.unloaded', { layer, cx, cy });
    }
  }

  /** Applies a `tileUpdate`; ignored for a chunk that is not loaded. */
  applyTileUpdate({ layer, x, y, slot, tile }: TileUpdateMessage): void {
    const chunk = this.get(layer, chunkCoord(x), chunkCoord(y));
    if (!chunk) {
      return;
    }
    chunk.slot(slot)[tileIndex(localCoord(x), localCoord(y))] =
      tile === null ? EMPTY_TILE : tileCode(this.content, tile);
    this.bus.emit('chunk.changed', { chunk });
  }

  /** Forgets every chunk (connection lost: the server sends them again). */
  clear(): void {
    for (const chunk of [...this.chunks.values()]) {
      this.unload(chunk.layer, chunk.cx, chunk.cy);
    }
  }
}
