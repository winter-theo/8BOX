import { describe, expect, it } from 'vitest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { Chunk } from './chunk';
import {
  CHUNK_AREA,
  CHUNK_SIZE,
  chunkCoord,
  chunksPerSide,
  LAYER,
  localCoord,
  tileIndex,
} from './coords';
import { EMPTY_TILE, tileCode, tileOfCode } from './tileCodes';

describe('world coordinates', () => {
  it('finds the chunk of a tile or of a position, negative ones included', () => {
    expect(CHUNK_SIZE).toBe(32);
    expect(chunkCoord(0)).toBe(0);
    expect(chunkCoord(31.9)).toBe(0);
    expect(chunkCoord(32)).toBe(1);
    expect(chunkCoord(-1)).toBe(-1);
  });

  it('finds the coordinate inside the chunk', () => {
    expect(localCoord(0)).toBe(0);
    expect(localCoord(33)).toBe(1);
    expect(localCoord(33.7)).toBe(1);
    expect(localCoord(-1)).toBe(31);
  });

  it('indexes the tiles of a chunk row by row', () => {
    expect(tileIndex(0, 0)).toBe(0);
    expect(tileIndex(5, 0)).toBe(5);
    expect(tileIndex(0, 1)).toBe(CHUNK_SIZE);
    expect(tileIndex(CHUNK_SIZE - 1, CHUNK_SIZE - 1)).toBe(CHUNK_AREA - 1);
  });

  it('counts the chunks of a layer', () => {
    expect(chunksPerSide(1024)).toBe(32);
    expect(chunksPerSide(100)).toBe(4);
  });
});

describe('Chunk', () => {
  it('has three empty slots and no meta', () => {
    const chunk = new Chunk(LAYER.surface, 2, 3);

    expect(chunk.ground).toHaveLength(CHUNK_AREA);
    expect(chunk.slot('object').every((code) => code === EMPTY_TILE)).toBe(true);
    expect(chunk.meta.size).toBe(0);
  });
});

describe('tile codes', () => {
  const content = loadContent(baseContent);

  it('round-trips between ids and codes, 0 being empty', () => {
    const code = tileCode(content, 'base:grass');

    expect(code).toBeGreaterThan(EMPTY_TILE);
    expect(tileOfCode(content, code)?.id).toBe('base:grass');
    expect(tileOfCode(content, EMPTY_TILE)).toBeUndefined();
  });

  it('rejects an unknown tile', () => {
    expect(() => tileCode(content, 'base:lava')).toThrow('Unknown tile "base:lava"');
  });
});
