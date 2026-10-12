import { WORLD } from '../config/world';

/** Layers of the world. They share the same coordinates: tile (x, y) of the mine is under (x, y) of the surface. */
export const LAYER = { surface: 0, mine: -1, upper: 1 } as const;
export type LayerId = (typeof LAYER)[keyof typeof LAYER];

/** Side of a chunk, in tiles. */
export const CHUNK_SIZE = WORLD.chunkSizeTiles;
/** Number of tiles in a chunk. */
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;

/** Chunk coordinate containing a tile coordinate (or an entity position, in tiles). */
export function chunkCoord(tile: number): number {
  return Math.floor(tile / CHUNK_SIZE);
}

/** Coordinate of a tile inside its chunk, from 0 to CHUNK_SIZE - 1. */
export function localCoord(tile: number): number {
  return Math.floor(tile) - chunkCoord(tile) * CHUNK_SIZE;
}

/** Index of a tile in the arrays of its chunk (row by row). */
export function tileIndex(localX: number, localY: number): number {
  return localY * CHUNK_SIZE + localX;
}

/** Number of chunks along one side of a layer. */
export function chunksPerSide(layerSizeTiles: number): number {
  return Math.ceil(layerSizeTiles / CHUNK_SIZE);
}
