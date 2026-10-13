import {
  type Chunk,
  type Content,
  chunkCoord,
  chunksPerSide,
  createSurfaceGenerator,
  LAYER,
  type LayerId,
  localCoord,
  metaAfterObjectChange,
  type TileDef,
  type TileMeta,
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

/** The state (meta) of one tile changed. */
export interface TileMetaChange {
  layer: LayerId;
  x: number;
  y: number;
  /** New meta, or null when the tile has none now. */
  meta: TileMeta | null;
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
  private metaListener: ((change: TileMetaChange) => void) | undefined;

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
    return World.load(options, []).world;
  }

  /**
   * The saved chunks of the surface, and the missing ones generated from the seed. Returns the world and
   * the chunks it had to generate (to be saved, so that the world no longer depends on the generator).
   */
  static load(
    options: WorldOptions,
    saved: readonly Chunk[],
  ): { world: World; generated: Chunk[] } {
    const generator = createSurfaceGenerator(options);
    const side = chunksPerSide(options.layerSizeTiles);
    const savedByKey = new Map<string, Chunk>();
    for (const chunk of saved) {
      if (chunk.layer === LAYER.surface) {
        savedByKey.set(`${chunk.cx}:${chunk.cy}`, chunk);
      }
    }
    const surface: Chunk[] = [];
    const generated: Chunk[] = [];
    for (let cy = 0; cy < side; cy++) {
      for (let cx = 0; cx < side; cx++) {
        let chunk = savedByKey.get(`${cx}:${cy}`);
        if (!chunk) {
          chunk = generator.generateChunk(cx, cy);
          generated.push(chunk);
        }
        surface.push(chunk);
      }
    }
    return { world: new World(options, generator.spawn, surface), generated };
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

  /**
   * Puts a tile in a slot (`null` empties it) and marks its chunk as modified. A new object (or none)
   * also clears the meta of the tile, but its room: the rest belongs to the object (an open door).
   */
  setTile(layer: LayerId, x: number, y: number, slot: TileSlot, id: string | null): void {
    const chunk = this.chunkOf(layer, x, y);
    const code = id === null ? 0 : tileCode(this.content, id);
    const index = tileIndex(localCoord(x), localCoord(y));
    chunk.slot(slot)[index] = code;
    if (slot === 'object') {
      const kept = metaAfterObjectChange(chunk.meta.get(index));
      if (kept) {
        chunk.meta.set(index, kept);
      } else {
        chunk.meta.delete(index);
      }
    }
    this.dirty.add(chunk);
    this.changeListener?.({ layer, x, y, slot, tile: id });
  }

  /** State of tile (x, y) (an open door); undefined when it has none or is outside the world. */
  getMeta(layer: LayerId, x: number, y: number): TileMeta | undefined {
    const chunk = this.isInside(x, y) && this.getChunk(layer, chunkCoord(x), chunkCoord(y));
    return chunk ? chunk.meta.get(tileIndex(localCoord(x), localCoord(y))) : undefined;
  }

  /** Sets the state of tile (x, y) (`undefined` clears it) and marks its chunk as modified. */
  setMeta(layer: LayerId, x: number, y: number, meta: TileMeta | undefined): void {
    const chunk = this.chunkOf(layer, x, y);
    const index = tileIndex(localCoord(x), localCoord(y));
    if (meta === undefined) {
      chunk.meta.delete(index);
    } else {
      chunk.meta.set(index, meta);
    }
    this.dirty.add(chunk);
    this.metaListener?.({ layer, x, y, meta: meta ?? null });
  }

  /**
   * Marks the chunk of tile (x, y) as holding a player construction (`has_player_build`): the
   * regeneration of P12 spares it.
   */
  markPlayerBuild(layer: LayerId, x: number, y: number): void {
    const chunk = this.chunkOf(layer, x, y);
    if (!chunk.hasPlayerBuild) {
      chunk.hasPlayerBuild = true;
      this.dirty.add(chunk);
    }
  }

  /** Called after every `setTile` (the server context turns it into a `tile.changed` event). */
  onChange(listener: (change: TileChange) => void): void {
    this.changeListener = listener;
  }

  /** Called after every `setMeta` (the server context turns it into a `tile.meta` event). */
  onMetaChange(listener: (change: TileMetaChange) => void): void {
    this.metaListener = listener;
  }

  private chunkOf(layer: LayerId, x: number, y: number): Chunk {
    const chunk = this.isInside(x, y) && this.getChunk(layer, chunkCoord(x), chunkCoord(y));
    if (!chunk) {
      throw new RangeError(`Tile (${x}, ${y}) of layer ${layer} is outside the world`);
    }
    return chunk;
  }

  /** Chunks modified since the last call (for saving, step 10). */
  takeDirtyChunks(): Chunk[] {
    const chunks = [...this.dirty];
    this.dirty.clear();
    return chunks;
  }
}
