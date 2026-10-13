import type { TileSlot } from '../content/schemas';
import { CHUNK_AREA, type LayerId } from './coords';

/** State of one tile that does not fit in the arrays (door open, damage taken, owner, growth…). */
export type TileMeta = Record<string, unknown>;

/**
 * A square of CHUNK_SIZE × CHUNK_SIZE tiles of one layer. Each slot is an array of tile codes
 * (see `tileCode`: 0 = empty), indexed by `tileIndex(localX, localY)`.
 */
export class Chunk {
  readonly ground = new Uint16Array(CHUNK_AREA);
  readonly floor = new Uint16Array(CHUNK_AREA);
  readonly object = new Uint16Array(CHUNK_AREA);
  /** Sparse per-tile state, by tile index. */
  readonly meta = new Map<number, TileMeta>();
  /** A player built or broke a construction in it: the regeneration of P12 spares it (server only). */
  hasPlayerBuild = false;

  constructor(
    readonly layer: LayerId,
    readonly cx: number,
    readonly cy: number,
  ) {}

  slot(slot: TileSlot): Uint16Array {
    return this[slot];
  }
}
