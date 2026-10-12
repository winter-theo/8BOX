import {
  CHUNK_AREA,
  Chunk,
  type Content,
  EMPTY_TILE,
  encodeChunk,
  type LayerId,
  type TileMeta,
} from '@8box/shared';

/** Format of `SavedChunk.palette` and `SavedChunk.data` (the `version` column). */
export const CHUNK_FORMAT_VERSION = 1;

/** Palette entry of an empty slot. */
const EMPTY_ID = '';
const SLOTS = ['ground', 'floor', 'object'] as const;

/**
 * A chunk as the database keeps it: its tiles are indices into its own palette of tile ids, never the
 * runtime codes, so that adding, removing or reordering content keeps saves valid.
 */
export interface SavedChunk {
  layer: number;
  cx: number;
  cy: number;
  /** Tile ids; index 0 is '' (empty). */
  palette: string[];
  /** Ground, floor then object indices: 1 byte each, or 2 (little-endian) when the palette is long. */
  data: Uint8Array;
  /** Per-tile state: [tile index, meta] pairs. */
  meta: [number, TileMeta][];
}

export function serializeChunk(chunk: Chunk, content: Content): SavedChunk {
  const encoded = encodeChunk(chunk, content);
  const data = new Uint8Array(encoded.ground.length * SLOTS.length);
  SLOTS.forEach((slot, i) => {
    data.set(encoded[slot], i * encoded[slot].length);
  });
  return {
    layer: chunk.layer,
    cx: chunk.cx,
    cy: chunk.cy,
    palette: encoded.palette,
    data,
    meta: encoded.meta,
  };
}

export interface LoadedChunk {
  chunk: Chunk;
  /** Saved tile ids the content no longer has: those tiles are now empty. */
  unknownIds: string[];
}

/** Rebuilds a chunk with the codes of the current content; a tile that left the content becomes empty. */
export function deserializeChunk(saved: SavedChunk, content: Content): LoadedChunk {
  const unknownIds: string[] = [];
  const codes = saved.palette.map((id) => {
    if (id === EMPTY_ID) {
      return EMPTY_TILE;
    }
    const index = content.tiles.indexOf(id);
    if (index === undefined) {
      unknownIds.push(id);
      return EMPTY_TILE;
    }
    return index + 1;
  });
  const bytesPerIndex = saved.data.length / (SLOTS.length * CHUNK_AREA);
  if (bytesPerIndex !== 1 && bytesPerIndex !== 2) {
    throw new Error(`Saved chunk (${saved.cx}, ${saved.cy}): bad data size ${saved.data.length}`);
  }
  const view = new DataView(saved.data.buffer, saved.data.byteOffset, saved.data.byteLength);
  const chunk = new Chunk(saved.layer as LayerId, saved.cx, saved.cy);
  SLOTS.forEach((slot, s) => {
    const target = chunk.slot(slot);
    const start = s * CHUNK_AREA;
    for (let i = 0; i < CHUNK_AREA; i++) {
      const index =
        bytesPerIndex === 1 ? (saved.data[start + i] ?? 0) : view.getUint16((start + i) * 2, true);
      target[i] = codes[index] ?? EMPTY_TILE;
    }
  });
  for (const [index, meta] of saved.meta) {
    chunk.meta.set(index, meta);
  }
  return { chunk, unknownIds };
}
