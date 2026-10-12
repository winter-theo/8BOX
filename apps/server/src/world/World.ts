import {
  type Chunk,
  type Content,
  chunkCoord,
  chunksPerSide,
  createSurfaceGenerator,
  LAYER,
  type LayerId,
  localCoord,
  type TileDef,
  type TileSlot,
  tileCode,
  tileIndex,
  tileOfCode,
} from '@8box/shared';

/** One slot of one tile changed. */
export interface TileChange {
  layer: LayerId;
  x: number;
  y: number;
  slot: TileSlot;
  /** New tile id, or null when the slot is now empty. */
  tile: string | null;
}

export interface WorldOptions {
  seed: number;
  content: Content;
  /** Width and height of a layer, in tiles. */
  layerSizeTiles: number;
}

/** The world in memory. Only the surface exists for now (the mine comes with P1). */
export class World {
  readonly seed: number;
  readonly layerSizeTiles: number;
  readonly chunksPerSide: number;
  /** Center of the spawn tile, in tiles. */
  readonly spawn: { readonly x: number; readonly y: number };
  private readonly content: Content;
  private readonly surface: Chunk[];
  private readonly dirty = new Set<Chunk>();
  private changeListener: ((change: TileChange) => void) | undefined;

  private constructor(options: WorldOptions, spawn: { x: number; y: number }, surface: Chunk[]) {
    this.seed = options.seed;
    this.content = options.content;
    this.layerSizeTiles = options.layerSizeTiles;
    this.chunksPerSide = chunksPerSide(options.layerSizeTiles);
    this.spawn = spawn;
    this.surface = surface;
  }

  /** Generates every chunk of the surface from the seed. */
  static generate(options: WorldOptions): World {
    const generator = createSurfaceGenerator(options);
    const side = chunksPerSide(options.layerSizeTiles);
    const surface: Chunk[] = [];
    for (let cy = 0; cy < side; cy++) {
      for (let cx = 0; cx < side; cx++) {
        surface.push(generator.generateChunk(cx, cy));
      }
    }
    return new World(options, generator.spawn, surface);
  }

  get chunkCount(): number {
    return this.surface.length;
  }

  isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.layerSizeTiles && y < this.layerSizeTiles;
  }

  getChunk(layer: LayerId, cx: number, cy: number): Chunk | undefined {
    if (layer !== LAYER.surface || cx < 0 || cy < 0) {
      return undefined;
    }
    if (cx >= this.chunksPerSide || cy >= this.chunksPerSide) {
      return undefined;
    }
    return this.surface[cy * this.chunksPerSide + cx];
  }

  /** Tile in a slot of tile (x, y); undefined when the slot is empty or outside the world. */
  getTile(layer: LayerId, x: number, y: number, slot: TileSlot): TileDef | undefined {
    const chunk = this.isInside(x, y) && this.getChunk(layer, chunkCoord(x), chunkCoord(y));
    if (!chunk) {
      return undefined;
    }
    const code = chunk.slot(slot)[tileIndex(localCoord(x), localCoord(y))] ?? 0;
    return tileOfCode(this.content, code);
  }

  /** Puts a tile in a slot (`null` empties it) and marks its chunk as modified. */
  setTile(layer: LayerId, x: number, y: number, slot: TileSlot, id: string | null): void {
    const chunk = this.isInside(x, y) && this.getChunk(layer, chunkCoord(x), chunkCoord(y));
    if (!chunk) {
      throw new RangeError(`Tile (${x}, ${y}) of layer ${layer} is outside the world`);
    }
    const code = id === null ? 0 : tileCode(this.content, id);
    chunk.slot(slot)[tileIndex(localCoord(x), localCoord(y))] = code;
    this.dirty.add(chunk);
    this.changeListener?.({ layer, x, y, slot, tile: id });
  }

  /** Called after every `setTile` (the server context turns it into a `tile.changed` event). */
  onChange(listener: (change: TileChange) => void): void {
    this.changeListener = listener;
  }

  /** Chunks modified since the last call (for saving, step 10). */
  takeDirtyChunks(): Chunk[] {
    const chunks = [...this.dirty];
    this.dirty.clear();
    return chunks;
  }
}
