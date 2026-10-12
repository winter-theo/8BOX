import { baseContent, LAYER, loadContent, WORLD } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { randomSeed } from './seed';
import { World } from './World';

const content = loadContent(baseContent);
const SIZE = 64;
const generate = (seed = 3) => World.generate({ seed, content, layerSizeTiles: SIZE });

describe('World', () => {
  it('generates every chunk of the surface', () => {
    const world = generate();

    expect(world.chunkCount).toBe(4);
    expect(world.getChunk(LAYER.surface, 1, 1)).toBeDefined();
    expect(world.getChunk(LAYER.surface, 2, 0)).toBeUndefined();
    expect(world.getChunk(LAYER.mine, 0, 0)).toBeUndefined();
  });

  it('reads tiles by slot, and nothing outside the world', () => {
    const world = generate();

    expect(world.getTile(LAYER.surface, 10, 10, 'ground')).toBeDefined();
    expect(world.getTile(LAYER.surface, 10, 10, 'floor')).toBeUndefined();
    expect(world.getTile(LAYER.surface, -1, 10, 'ground')).toBeUndefined();
    expect(world.getTile(LAYER.surface, SIZE, 10, 'ground')).toBeUndefined();
  });

  it('is the same for the same seed', () => {
    const a = generate(9);
    const b = generate(9);

    for (let y = 0; y < SIZE; y += 7) {
      for (let x = 0; x < SIZE; x += 5) {
        expect(a.getTile(LAYER.surface, x, y, 'object')).toBe(
          b.getTile(LAYER.surface, x, y, 'object'),
        );
      }
    }
  });

  it('sets tiles and marks their chunk as modified', () => {
    const world = generate();

    world.setTile(LAYER.surface, 40, 5, 'object', 'base:berry_bush');
    world.setTile(LAYER.surface, 41, 6, 'floor', null);

    expect(world.getTile(LAYER.surface, 40, 5, 'object')?.id).toBe('base:berry_bush');
    const dirty = world.takeDirtyChunks();
    expect(dirty.map((chunk) => [chunk.cx, chunk.cy])).toEqual([[1, 0]]);
    expect(world.takeDirtyChunks()).toEqual([]);
  });

  it('refuses to set a tile outside the world', () => {
    const world = generate();

    expect(() => world.setTile(LAYER.surface, SIZE, 0, 'object', 'base:flowers')).toThrow(
      RangeError,
    );
  });

  it('spawns players in the clear center of the map', () => {
    const world = generate();

    expect(world.spawn).toEqual({ x: SIZE / 2 + 0.5, y: SIZE / 2 + 0.5 });
    const x = Math.floor(world.spawn.x);
    const y = Math.floor(world.spawn.y);
    expect(world.getTile(LAYER.surface, x, y, 'object')).toBeUndefined();
    expect(world.getTile(LAYER.surface, x, y, 'ground')?.solid).toBe(false);
    expect(WORLD.spawnClearingRadiusTiles).toBeGreaterThan(0);
  });

  it('draws random 32-bit seeds', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});
