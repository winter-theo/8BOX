import {
  baseContent,
  Chunk,
  encodeChunk,
  LAYER,
  loadContent,
  TypedEmitter,
  tileCode,
  tileIndex,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import type { ClientEvents } from '../events';
import { ChunkCache } from './ChunkCache';

const content = loadContent(baseContent);

function setup() {
  const bus = new TypedEmitter<ClientEvents>();
  const log: string[] = [];
  bus.on('chunk.loaded', ({ chunk }) => log.push(`loaded ${chunk.cx},${chunk.cy}`));
  bus.on('chunk.unloaded', ({ cx, cy }) => log.push(`unloaded ${cx},${cy}`));
  bus.on('tile.meta', ({ chunk, x, y }) => log.push(`meta ${chunk.cx},${chunk.cy} ${x},${y}`));
  bus.on('tile.changed', ({ chunk, x, y, slot }) =>
    log.push(`changed ${chunk.cx},${chunk.cy} ${x},${y} ${slot}`),
  );
  return { cache: new ChunkCache(content, bus), log };
}

function grassChunk(cx: number, cy: number) {
  const chunk = new Chunk(LAYER.surface, cx, cy);
  chunk.ground.fill(tileCode(content, 'base:grass'));
  return encodeChunk(chunk, content);
}

describe('ChunkCache', () => {
  it('stores received chunks and reads their tiles', () => {
    const { cache, log } = setup();

    cache.load(grassChunk(2, 3));

    expect(cache.size).toBe(1);
    expect(cache.getTile(0, 64, 96, 'ground')?.id).toBe('base:grass');
    expect(cache.getTile(0, 64, 96, 'object')).toBeUndefined();
    expect(cache.getTile(0, 0, 0, 'ground')).toBeUndefined();
    expect(log).toEqual(['loaded 2,3']);
  });

  it('applies tile updates to loaded chunks only', () => {
    const { cache, log } = setup();
    cache.load(grassChunk(0, 0));

    cache.applyTileUpdate({
      t: 'tileUpdate',
      layer: 0,
      x: 5,
      y: 6,
      slot: 'floor',
      tile: 'base:sand',
    });
    cache.applyTileUpdate({
      t: 'tileUpdate',
      layer: 0,
      x: 500,
      y: 6,
      slot: 'floor',
      tile: 'base:sand',
    });

    expect(cache.getTile(0, 5, 6, 'floor')?.id).toBe('base:sand');
    cache.applyTileUpdate({ t: 'tileUpdate', layer: 0, x: 5, y: 6, slot: 'floor', tile: null });
    expect(cache.getTile(0, 5, 6, 'floor')).toBeUndefined();
    expect(log).toEqual(['loaded 0,0', 'changed 0,0 5,6 floor', 'changed 0,0 5,6 floor']);
  });

  it('keeps the state of tiles (doors), cleared when their object changes', () => {
    const { cache, log } = setup();
    const chunk = new Chunk(LAYER.surface, 0, 0);
    chunk.object[tileIndex(5, 6)] = tileCode(content, 'base:wooden_door');
    chunk.meta.set(tileIndex(5, 6), { open: true });
    cache.load(encodeChunk(chunk, content));
    expect(cache.getMeta(0, 5, 6)).toEqual({ open: true });

    cache.applyTileMeta({ t: 'tileMeta', layer: 0, x: 5, y: 6, meta: null });
    expect(cache.getMeta(0, 5, 6)).toBeUndefined();
    cache.applyTileMeta({ t: 'tileMeta', layer: 0, x: 5, y: 6, meta: { open: true } });
    expect(cache.getMeta(0, 5, 6)).toEqual({ open: true });
    cache.applyTileUpdate({ t: 'tileUpdate', layer: 0, x: 5, y: 6, slot: 'floor', tile: null });
    expect(cache.getMeta(0, 5, 6)).toEqual({ open: true });
    cache.applyTileUpdate({ t: 'tileUpdate', layer: 0, x: 5, y: 6, slot: 'object', tile: null });
    expect(cache.getMeta(0, 5, 6)).toBeUndefined();
    expect(log.slice(1, 3)).toEqual(['meta 0,0 5,6', 'meta 0,0 5,6']);

    // The room of a tile stays when its object changes.
    cache.applyTileMeta({ t: 'tileMeta', layer: 0, x: 5, y: 6, meta: { room: 7, open: true } });
    cache.applyTileUpdate({ t: 'tileUpdate', layer: 0, x: 5, y: 6, slot: 'object', tile: null });
    expect(cache.getMeta(0, 5, 6)).toEqual({ room: 7 });
  });
  it('unloads one chunk or all of them', () => {
    const { cache, log } = setup();
    cache.load(grassChunk(0, 0));
    cache.load(grassChunk(1, 0));
    cache.load(grassChunk(2, 0));

    cache.unload(0, 1, 0);
    cache.unload(0, 9, 9);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(log.filter((line) => line.startsWith('unloaded'))).toEqual([
      'unloaded 1,0',
      'unloaded 0,0',
      'unloaded 2,0',
    ]);
  });
});
