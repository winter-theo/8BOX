import type { Content } from '../content/load';
import type { TileSlot } from '../content/schemas';
import { Chunk } from '../world/chunk';
import { CHUNK_AREA, type LayerId } from '../world/coords';
import { EMPTY_TILE, tileCode, tileOfCode } from '../world/tileCodes';
import type { ChunkMessage } from './messages';

const SLOTS: readonly TileSlot[] = ['ground', 'floor', 'object'];
/** Palette entry of an empty slot. */
const EMPTY_ID = '';
/** Palettes up to this size fit in one byte per tile. */
const NARROW_PALETTE_MAX = 256;

/** Builds the `chunk` message of a chunk: a palette of tile ids and one small index per tile. */
export function encodeChunk(chunk: Chunk, content: Content): ChunkMessage {
  const palette = [EMPTY_ID];
  const paletteIndex = new Map<number, number>([[EMPTY_TILE, 0]]);
  const indicesOf = (codes: Uint16Array) =>
    Uint16Array.from(codes, (code) => {
      let index = paletteIndex.get(code);
      if (index === undefined) {
        const tile = tileOfCode(content, code);
        if (!tile) {
          throw new Error(`Chunk (${chunk.cx}, ${chunk.cy}) holds unknown tile code ${code}`);
        }
        index = palette.length;
        palette.push(tile.id);
        paletteIndex.set(code, index);
      }
      return index;
    });
  const [ground, floor, object] = SLOTS.map((slot) => indicesOf(chunk.slot(slot))) as [
    Uint16Array,
    Uint16Array,
    Uint16Array,
  ];
  const wide = palette.length > NARROW_PALETTE_MAX;
  const pack = (indices: Uint16Array) => (wide ? toBytesLE(indices) : Uint8Array.from(indices));
  return {
    t: 'chunk',
    layer: chunk.layer,
    cx: chunk.cx,
    cy: chunk.cy,
    palette,
    ground: pack(ground),
    floor: pack(floor),
    object: pack(object),
    ...(wide && { wide }),
    meta: [...chunk.meta],
  };
}

/** Rebuilds a chunk from its message, with the local tile codes of `content`. */
export function decodeChunk(message: ChunkMessage, content: Content): Chunk {
  const codes = message.palette.map((id) => (id === EMPTY_ID ? EMPTY_TILE : tileCode(content, id)));
  const chunk = new Chunk(message.layer as LayerId, message.cx, message.cy);
  for (const slot of SLOTS) {
    const indices = message.wide ? fromBytesLE(message[slot]) : message[slot];
    if (indices.length !== CHUNK_AREA) {
      throw new Error(`Chunk (${message.cx}, ${message.cy}): bad "${slot}" size ${indices.length}`);
    }
    const target = chunk.slot(slot);
    for (let i = 0; i < CHUNK_AREA; i++) {
      target[i] = codes[indices[i] ?? 0] ?? EMPTY_TILE;
    }
  }
  for (const [index, meta] of message.meta) {
    chunk.meta.set(index, meta);
  }
  return chunk;
}

function toBytesLE(values: Uint16Array): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) {
    view.setUint16(i * 2, values[i] ?? 0, true);
  }
  return bytes;
}

function fromBytesLE(bytes: Uint8Array): Uint16Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Uint16Array.from({ length: bytes.length / 2 }, (_, i) => view.getUint16(i * 2, true));
}
