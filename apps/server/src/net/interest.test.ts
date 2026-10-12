import { describe, expect, it } from 'vitest';
import {
  ChunkSubscriptions,
  chunkKey,
  chunksInView,
  entitiesInChunks,
  type InterestOptions,
} from './interest';

const OPTIONS: InterestOptions = {
  tileSizePx: 8,
  chunksPerSide: 32,
  maxRadiusChunks: 3,
  prefetchMarginChunks: 1,
  unloadMarginChunks: 1,
};
const SPAWN = { layer: 0, x: 512.5, y: 512.5 };
/** 1280 × 720 at zoom 4: 40 × 22.5 tiles. */
const VIEW = { w: 1280, h: 720, zoom: 4 };

const keys = (refs: { layer: number; cx: number; cy: number }[]) => refs.map(chunkKey).sort();

describe('chunksInView', () => {
  it('covers the visible tiles plus the margin', () => {
    // x: 492.5 → 532.5 = chunks 15 → 16; y: 501.25 → 523.75 = chunks 15 → 16.
    expect(chunksInView(SPAWN, VIEW, 1, OPTIONS)).toEqual({
      layer: 0,
      minCx: 14,
      maxCx: 17,
      minCy: 14,
      maxCy: 17,
    });
  });

  it('is capped around the center chunk for huge views', () => {
    const rect = chunksInView(SPAWN, { w: 8000, h: 8000, zoom: 1 }, 1, OPTIONS);

    expect(rect).toEqual({ layer: 0, minCx: 12, maxCx: 20, minCy: 12, maxCy: 20 });
  });

  it('uses the max radius while the view size is unknown', () => {
    const rect = chunksInView(SPAWN, undefined, 0, OPTIONS);

    expect([rect.minCx, rect.maxCx]).toEqual([13, 19]);
  });

  it('is clipped to the world', () => {
    const rect = chunksInView({ layer: 0, x: 3, y: 1020 }, VIEW, 1, OPTIONS);

    expect([rect.minCx, rect.maxCy]).toEqual([0, 31]);
  });
});

describe('ChunkSubscriptions', () => {
  it('sends the nearest chunks first, a few per call, until the view is covered', () => {
    const subs = new ChunkSubscriptions(OPTIONS);

    const first = subs.update(SPAWN, VIEW, 4);
    expect(keys(first.add)).toEqual(
      keys([
        { layer: 0, cx: 15, cy: 15 },
        { layer: 0, cx: 15, cy: 16 },
        { layer: 0, cx: 16, cy: 15 },
        { layer: 0, cx: 16, cy: 16 },
      ]),
    );

    let total = first.add.length;
    for (let i = 0; i < 10; i++) {
      total += subs.update(SPAWN, VIEW, 4).add.length;
    }
    expect(total).toBe(16);
    expect(subs.size).toBe(16);
    expect(subs.update(SPAWN, VIEW, 4)).toEqual({ add: [], remove: [] });
  });

  it('releases the chunks left behind and loads the new ones when the center moves', () => {
    const subs = new ChunkSubscriptions(OPTIONS);
    subs.update(SPAWN, VIEW, 100);

    const moved = subs.update({ layer: 0, x: 512.5 + 10 * 32, y: 512.5 }, VIEW, 100);

    expect(moved.remove.length).toBe(16);
    expect(moved.add.length).toBe(16);
    expect(subs.has({ layer: 0, cx: 15, cy: 15 })).toBe(false);
    expect(subs.has({ layer: 0, cx: 25, cy: 15 })).toBe(true);
  });

  it('keeps a chunk until it is past the unload margin (no flicker at the border)', () => {
    const subs = new ChunkSubscriptions(OPTIONS);
    subs.update(SPAWN, VIEW, 100);

    const oneChunkEast = subs.update({ layer: 0, x: 512.5 + 32, y: 512.5 }, VIEW, 100);
    expect(oneChunkEast.remove).toEqual([]);

    const twoChunksEast = subs.update({ layer: 0, x: 512.5 + 64, y: 512.5 }, VIEW, 100);
    expect(keys(twoChunksEast.remove)).toEqual(
      keys([14, 15, 16, 17].map((cy) => ({ layer: 0, cx: 14, cy }))),
    );
  });

  it('switches every chunk when the layer changes', () => {
    const subs = new ChunkSubscriptions(OPTIONS);
    subs.update(SPAWN, VIEW, 100);

    const mine = subs.update({ ...SPAWN, layer: -1 }, VIEW, 100);

    expect(mine.remove).toHaveLength(16);
    expect(mine.add.every((ref) => ref.layer === -1)).toBe(true);
  });
});

describe('entitiesInChunks', () => {
  const cells = new Map<string, ReadonlySet<number>>([
    ['0:1:1', new Set([1, 2])],
    ['0:1:2', new Set([3])],
    ['0:9:9', new Set([4])],
  ]);
  const inChunk = (ref: { layer: number; cx: number; cy: number }) =>
    cells.get(chunkKey(ref)) ?? new Set<number>();

  it('lists the entities of the given chunks only, without the client player', () => {
    const chunks = [
      { layer: 0, cx: 1, cy: 1 },
      { layer: 0, cx: 1, cy: 2 },
    ];
    expect(entitiesInChunks(chunks, inChunk, 2).sort()).toEqual([1, 3]);
    expect(entitiesInChunks(chunks, inChunk)).not.toContain(4);
    expect(entitiesInChunks([], inChunk)).toEqual([]);
  });
});
