import {
  baseContent,
  CHUNK_AREA,
  Chunk,
  type Content,
  LAYER,
  loadContent,
  type RawContent,
  tileCode,
  tileOfCode,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { deserializeChunk, serializeChunk } from './chunkSerializer';

const content = loadContent(baseContent);
const SLOTS = ['ground', 'floor', 'object'] as const;
const baseTiles = baseContent.tiles as { id: string }[];

/** A chunk of grass with a few objects and a meta, built with the codes of `source`. */
function sampleChunk(source: Content): Chunk {
  const chunk = new Chunk(LAYER.surface, 3, 7);
  chunk.ground.fill(tileCode(source, 'base:grass'));
  chunk.ground[5] = tileCode(source, 'base:shallow_water');
  chunk.object[10] = tileCode(source, 'base:oak_tree');
  chunk.object[CHUNK_AREA - 1] = tileCode(source, 'base:flowers');
  chunk.meta.set(10, { hp: 4 });
  return chunk;
}

/** Tile ids of every slot, comparable whatever the codes of the content. */
function idsOf(chunk: Chunk, source: Content) {
  return SLOTS.map((slot) =>
    Array.from(chunk.slot(slot), (code) => tileOfCode(source, code)?.id ?? ''),
  );
}

describe('chunk serialization', () => {
  it('round-trips the tiles, the coordinates and the meta', () => {
    const chunk = sampleChunk(content);

    const saved = serializeChunk(chunk, content);
    const { chunk: loaded, unknownIds } = deserializeChunk(saved, content);

    expect(saved.palette[0]).toBe('');
    expect(saved.data).toHaveLength(3 * CHUNK_AREA); // Short palette: 1 byte per tile and slot.
    expect([loaded.layer, loaded.cx, loaded.cy]).toEqual([LAYER.surface, 3, 7]);
    expect(idsOf(loaded, content)).toEqual(idsOf(chunk, content));
    expect(loaded.meta.get(10)).toEqual({ hp: 4 });
    expect(loaded.hasPlayerBuild).toBe(false);
    expect(unknownIds).toEqual([]);
  });

  it('keeps whether a player built in the chunk (absent in older saves: no)', () => {
    const chunk = sampleChunk(content);
    chunk.hasPlayerBuild = true;

    const saved = serializeChunk(chunk, content);
    expect(saved.hasPlayerBuild).toBe(true);
    expect(deserializeChunk(saved, content).chunk.hasPlayerBuild).toBe(true);
    const { hasPlayerBuild: _, ...older } = saved;
    expect(deserializeChunk(older, content).chunk.hasPlayerBuild).toBe(false);
  });

  it('keeps the tiles when the content changes order (codes change, ids stay)', () => {
    // A new tile whose id comes first shifts the code of every other tile.
    const newTile = { ...baseTiles[0], id: 'base:ash', sprite: 'ground.ash' };
    const reordered: RawContent = { ...baseContent, tiles: [newTile, ...baseTiles] };
    const otherContent = loadContent(reordered);
    expect(tileCode(otherContent, 'base:grass')).not.toBe(tileCode(content, 'base:grass'));

    const saved = serializeChunk(sampleChunk(content), content);
    const { chunk: loaded } = deserializeChunk(saved, otherContent);

    expect(idsOf(loaded, otherContent)).toEqual(idsOf(sampleChunk(content), content));
  });

  it('empties the tiles whose id left the content, and reports them', () => {
    const withoutFlowers: RawContent = {
      ...baseContent,
      tiles: baseTiles.filter((tile) => tile.id !== 'base:flowers'),
    };
    const smallerContent = loadContent(withoutFlowers);

    const saved = serializeChunk(sampleChunk(content), content);
    const { chunk: loaded, unknownIds } = deserializeChunk(saved, smallerContent);

    expect(unknownIds).toEqual(['base:flowers']);
    expect(loaded.object[CHUNK_AREA - 1]).toBe(0);
    expect(tileOfCode(smallerContent, loaded.object[10] ?? 0)?.id).toBe('base:oak_tree');
  });

  it('reads 2-byte indices when the palette is long', () => {
    const saved = serializeChunk(sampleChunk(content), content);
    // The same tiles, as a writer with more than 256 ids would store them.
    const wide = new Uint8Array(saved.data.length * 2);
    saved.data.forEach((index, i) => {
      wide[i * 2] = index;
    });

    const { chunk: loaded } = deserializeChunk({ ...saved, data: wide }, content);

    expect(idsOf(loaded, content)).toEqual(idsOf(sampleChunk(content), content));
  });

  it('refuses data of a wrong size', () => {
    const saved = serializeChunk(sampleChunk(content), content);
    expect(() => deserializeChunk({ ...saved, data: saved.data.slice(1) }, content)).toThrow(
      /bad data size/,
    );
  });
});
