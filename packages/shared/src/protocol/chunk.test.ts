import { describe, expect, it } from 'vitest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { Chunk } from '../world/chunk';
import { CHUNK_AREA, LAYER } from '../world/coords';
import { createSurfaceGenerator } from '../world/gen/surface';
import { tileCode } from '../world/tileCodes';
import { decodeChunk, encodeChunk } from './chunk';
import { decodeServerMessage, encodeMessage } from './codec';
import type { ChunkMessage } from './messages';

const content = loadContent(baseContent);

function expectSameTiles(a: Chunk, b: Chunk) {
  expect(b.ground).toEqual(a.ground);
  expect(b.floor).toEqual(a.floor);
  expect(b.object).toEqual(a.object);
  expect([...b.meta]).toEqual([...a.meta]);
}

describe('chunk encoding', () => {
  it('round-trips a generated chunk, with one byte per tile', () => {
    const chunk = createSurfaceGenerator({ seed: 5, content }).generateChunk(15, 16);
    chunk.floor[3] = tileCode(content, 'base:sand');
    chunk.meta.set(42, { hp: 3 });

    const message = encodeChunk(chunk, content);

    expect(message.palette[0]).toBe('');
    expect(message.ground).toHaveLength(CHUNK_AREA);
    expect(message.wide).toBeUndefined();
    expectSameTiles(chunk, decodeChunk(message, content));
  });

  it('survives msgpack and stays compact', () => {
    const chunk = createSurfaceGenerator({ seed: 5, content }).generateChunk(3, 4);
    const bytes = encodeMessage(encodeChunk(chunk, content));

    const decoded = decodeServerMessage(bytes) as ChunkMessage;

    expect(bytes.byteLength).toBeLessThan(3 * CHUNK_AREA + 200);
    expectSameTiles(chunk, decodeChunk(decoded, content));
  });

  it('uses two bytes per tile when the palette is large', () => {
    const tiles = Array.from({ length: 300 }, (_, i) => ({
      id: `test:t${String(i).padStart(3, '0')}`,
      slot: 'ground',
      sprite: 'ground.test',
      solid: false,
      tall: false,
      hp: 0,
    }));
    const big = loadContent({ tiles, items: [], recipes: [], loot: [], creatures: [] });
    const chunk = new Chunk(LAYER.surface, 0, 0);
    for (let i = 0; i < CHUNK_AREA; i++) {
      chunk.ground[i] = 1 + (i % 300);
    }

    const message = encodeChunk(chunk, big);

    expect(message.wide).toBe(true);
    expect(message.ground).toHaveLength(2 * CHUNK_AREA);
    expectSameTiles(
      chunk,
      decodeChunk(decodeServerMessage(encodeMessage(message)) as ChunkMessage, big),
    );
  });

  it('maps tiles by id, not by runtime code', () => {
    const chunk = new Chunk(LAYER.surface, 0, 0);
    chunk.ground.fill(tileCode(content, 'base:sand'));
    const message = encodeChunk(chunk, content);

    expect(message.palette).toEqual(['', 'base:sand']);
    expect(message.ground.every((index) => index === 1)).toBe(true);
  });

  it('rejects a slot of the wrong size', () => {
    const message = encodeChunk(new Chunk(LAYER.surface, 0, 0), content);

    expect(() => decodeChunk({ ...message, floor: new Uint8Array(3) }, content)).toThrow('floor');
  });
});
