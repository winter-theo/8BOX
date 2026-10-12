import { CHUNK_SIZE, chunkCoord } from '@8box/shared';

export interface ChunkRef {
  layer: number;
  cx: number;
  cy: number;
}

/** Size of a client's game view. */
export interface ViewSize {
  /** In CSS pixels. */
  w: number;
  h: number;
  /** Screen pixels per world pixel. */
  zoom: number;
}

export interface InterestOptions {
  /** Side of a tile, in world pixels. */
  tileSizePx: number;
  /** Chunks of a layer side; chunks outside [0, chunksPerSide) do not exist. */
  chunksPerSide: number;
  /** Max distance from the center chunk, in chunks (before the margins). */
  maxRadiusChunks: number;
  /** Chunks loaded beyond the edge of the view. */
  prefetchMarginChunks: number;
  /** Extra chunks kept before releasing one (avoids flicker at the border). */
  unloadMarginChunks: number;
}

export interface ChunkRect {
  layer: number;
  minCx: number;
  maxCx: number;
  minCy: number;
  maxCy: number;
}

export function chunkKey({ layer, cx, cy }: ChunkRef): string {
  return `${layer}:${cx}:${cy}`;
}

function inRect(rect: ChunkRect, ref: ChunkRef): boolean {
  return (
    ref.layer === rect.layer &&
    ref.cx >= rect.minCx &&
    ref.cx <= rect.maxCx &&
    ref.cy >= rect.minCy &&
    ref.cy <= rect.maxCy
  );
}

/**
 * Chunks a view centered on `center` (in tiles) can show, plus `margin` chunks, at most
 * `maxRadiusChunks + margin` from the center chunk, clipped to the world. Without a known view size,
 * the max radius is used.
 */
export function chunksInView(
  center: { layer: number; x: number; y: number },
  view: ViewSize | undefined,
  margin: number,
  options: InterestOptions,
): ChunkRect {
  const centerCx = chunkCoord(center.x);
  const centerCy = chunkCoord(center.y);
  const limit = options.maxRadiusChunks + margin;
  const span = (centerTile: number, centerChunk: number, sizePx: number | undefined) => {
    let min = centerChunk - limit;
    let max = centerChunk + limit;
    if (view && sizePx !== undefined) {
      const halfTiles = sizePx / (view.zoom * options.tileSizePx) / 2;
      min = Math.max(min, chunkCoord(centerTile - halfTiles) - margin);
      max = Math.min(max, chunkCoord(centerTile + halfTiles) + margin);
    }
    return [Math.max(0, min), Math.min(options.chunksPerSide - 1, max)] as const;
  };
  const [minCx, maxCx] = span(center.x, centerCx, view?.w);
  const [minCy, maxCy] = span(center.y, centerCy, view?.h);
  return { layer: center.layer, minCx, maxCx, minCy, maxCy };
}

/** The chunks one client is subscribed to, kept in step with its view. */
export class ChunkSubscriptions {
  private readonly subscribed = new Map<string, ChunkRef>();

  constructor(private readonly options: InterestOptions) {}

  get size(): number {
    return this.subscribed.size;
  }

  has(ref: ChunkRef): boolean {
    return this.subscribed.has(chunkKey(ref));
  }

  /** The subscribed chunks. */
  chunks(): IterableIterator<ChunkRef> {
    return this.subscribed.values();
  }

  /**
   * Follows the view: returns the chunks to send now (the nearest first, at most `maxAdds`; the others
   * come on the next calls) and the chunks to release (beyond the unload margin).
   */
  update(
    center: { layer: number; x: number; y: number },
    view: ViewSize | undefined,
    maxAdds: number,
  ): { add: ChunkRef[]; remove: ChunkRef[] } {
    const { prefetchMarginChunks, unloadMarginChunks } = this.options;
    const wanted = chunksInView(center, view, prefetchMarginChunks, this.options);
    const keep = chunksInView(
      center,
      view,
      prefetchMarginChunks + unloadMarginChunks,
      this.options,
    );

    const remove: ChunkRef[] = [];
    for (const [key, ref] of this.subscribed) {
      if (!inRect(keep, ref)) {
        this.subscribed.delete(key);
        remove.push(ref);
      }
    }

    const centerCx = center.x / CHUNK_SIZE;
    const centerCy = center.y / CHUNK_SIZE;
    const missing: ChunkRef[] = [];
    for (let cy = wanted.minCy; cy <= wanted.maxCy; cy++) {
      for (let cx = wanted.minCx; cx <= wanted.maxCx; cx++) {
        const ref = { layer: wanted.layer, cx, cy };
        if (!this.subscribed.has(chunkKey(ref))) {
          missing.push(ref);
        }
      }
    }
    const distance = (ref: ChunkRef) =>
      (ref.cx + 0.5 - centerCx) ** 2 + (ref.cy + 0.5 - centerCy) ** 2;
    const add = missing.sort((a, b) => distance(a) - distance(b)).slice(0, maxAdds);
    for (const ref of add) {
      this.subscribed.set(chunkKey(ref), ref);
    }
    return { add, remove };
  }
}

/**
 * Entities a client sees: those in the chunks it receives, except its own player. A client never learns
 * about entities outside its chunks.
 */
export function entitiesInChunks(
  chunks: Iterable<ChunkRef>,
  inChunk: (ref: ChunkRef) => ReadonlySet<number>,
  self?: number,
): number[] {
  const visible: number[] = [];
  for (const ref of chunks) {
    for (const entity of inChunk(ref)) {
      if (entity !== self) {
        visible.push(entity);
      }
    }
  }
  return visible;
}
