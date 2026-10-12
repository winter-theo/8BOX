import type { Content } from '../content/load';
import type { TileDef } from '../content/schemas';

/**
 * Tile codes stored in chunk arrays: 0 means empty, otherwise the tile runtime index + 1.
 * Like runtime indexes, codes are never persisted nor sent as durable references.
 */
export const EMPTY_TILE = 0;

export function tileCode(content: Content, id: string): number {
  const index = content.tiles.indexOf(id);
  if (index === undefined) {
    throw new Error(`Unknown tile "${id}"`);
  }
  return index + 1;
}

/** Definition of a tile code; undefined for an empty slot. */
export function tileOfCode(content: Content, code: number): TileDef | undefined {
  return code === EMPTY_TILE ? undefined : content.tiles.byIndex(code - 1);
}
