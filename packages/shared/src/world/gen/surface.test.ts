import { beforeAll, describe, expect, it } from 'vitest';
import { WORLD } from '../../config/world';
import { WORLDGEN } from '../../config/worldgen';
import { baseContent } from '../../content/base';
import { type Content, loadContent } from '../../content/load';
import { CHUNK_SIZE, chunksPerSide, tileIndex } from '../coords';
import { EMPTY_TILE, tileCode, tileOfCode } from '../tileCodes';
import { createSurfaceGenerator } from './surface';

const content: Content = loadContent(baseContent);
const SIZE = WORLD.layerSizeTiles;
const CHUNKS = chunksPerSide(SIZE);
const ids = WORLDGEN.tiles;

/** Generates a whole surface and counts what is on it. */
function survey(seed: number) {
  const generator = createSurfaceGenerator({ seed, content });
  const ground = new Map<number, number>();
  const objects = new Map<number, number>();
  const center = Math.floor(SIZE / 2);
  let nearTrees = 0;
  let nearTiles = 0;
  let farTrees = 0;
  let farTiles = 0;
  const oak = tileCode(content, ids.oak);
  for (let cy = 0; cy < CHUNKS; cy++) {
    for (let cx = 0; cx < CHUNKS; cx++) {
      const chunk = generator.generateChunk(cx, cy);
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const i = tileIndex(lx, ly);
          const g = chunk.ground[i] ?? 0;
          const o = chunk.object[i] ?? 0;
          ground.set(g, (ground.get(g) ?? 0) + 1);
          objects.set(o, (objects.get(o) ?? 0) + 1);
          const d = Math.hypot(cx * CHUNK_SIZE + lx - center, cy * CHUNK_SIZE + ly - center);
          if (d > WORLD.spawnClearingRadiusTiles + 2 && d < 50) {
            nearTiles++;
            nearTrees += o === oak ? 1 : 0;
          } else if (d > 250) {
            farTiles++;
            farTrees += o === oak ? 1 : 0;
          }
        }
      }
    }
  }
  const share = (map: Map<number, number>, id: string) =>
    (map.get(tileCode(content, id)) ?? 0) / (SIZE * SIZE);
  return {
    generator,
    groundShare: (id: string) => share(ground, id),
    objectShare: (id: string) => share(objects, id),
    nearTreeDensity: nearTrees / nearTiles,
    farTreeDensity: farTrees / farTiles,
  };
}

describe('surface generation', () => {
  const SEEDS = [1, 20261011];
  const surveys: ReturnType<typeof survey>[] = [];

  beforeAll(() => {
    for (const seed of SEEDS) {
      surveys.push(survey(seed));
    }
  });

  it('gives the same chunks for the same seed, in any order', () => {
    const a = createSurfaceGenerator({ seed: 42, content });
    const b = createSurfaceGenerator({ seed: 42, content });
    const chunks: [number, number][] = [
      [0, 0],
      [16, 16],
      [31, 5],
      [7, 29],
    ];
    const fromA = chunks.map(([cx, cy]) => a.generateChunk(cx, cy));
    const fromB = [...chunks]
      .reverse()
      .map(([cx, cy]) => b.generateChunk(cx, cy))
      .reverse();

    fromA.forEach((chunk, i) => {
      expect(chunk.ground).toEqual(fromB[i]?.ground);
      expect(chunk.object).toEqual(fromB[i]?.object);
    });
  });

  it('gives different maps for different seeds', () => {
    const a = createSurfaceGenerator({ seed: 1, content }).generateChunk(10, 10);
    const b = createSurfaceGenerator({ seed: 2, content }).generateChunk(10, 10);

    expect(a.object).not.toEqual(b.object);
  });

  it('puts the spawn in a clear, walkable clearing at the center', () => {
    for (const { generator } of surveys) {
      const { x, y } = generator.spawn;
      expect([x, y]).toEqual([SIZE / 2 + 0.5, SIZE / 2 + 0.5]);
      const r = WORLD.spawnClearingRadiusTiles;
      for (let ty = Math.floor(y) - r; ty <= Math.floor(y) + r; ty++) {
        for (let tx = Math.floor(x) - r; tx <= Math.floor(x) + r; tx++) {
          if (Math.hypot(tx - Math.floor(x), ty - Math.floor(y)) > r) {
            continue;
          }
          const chunk = generator.generateChunk(
            Math.floor(tx / CHUNK_SIZE),
            Math.floor(ty / CHUNK_SIZE),
          );
          const i = tileIndex(tx % CHUNK_SIZE, ty % CHUNK_SIZE);
          expect(chunk.object[i]).toBe(EMPTY_TILE);
          expect(tileOfCode(content, chunk.ground[i] ?? 0)?.solid).toBe(false);
          expect(tileOfCode(content, chunk.ground[i] ?? 0)?.id).not.toContain('water');
        }
      }
    }
  });

  it('has reasonable proportions of water, beaches, meadows and forest', () => {
    for (const s of surveys) {
      const water = s.groundShare(ids.shallowWater) + s.groundShare(ids.deepWater);
      expect(water).toBeGreaterThan(0.1);
      expect(water).toBeLessThan(0.4);
      expect(s.groundShare(ids.deepWater)).toBeGreaterThan(0);
      expect(s.groundShare(ids.sand)).toBeGreaterThan(0.01);
      expect(s.groundShare(ids.grass)).toBeGreaterThan(0.3);
      expect(s.groundShare(ids.dirt)).toBeGreaterThan(0);
      for (const id of [ids.oak, ids.berryBush, ids.tallGrass, ids.flowers]) {
        expect(s.objectShare(id), id).toBeGreaterThan(0.001);
      }
    }
  });

  it('grows a dense forest around the spawn and sparser trees far away', () => {
    for (const s of surveys) {
      expect(s.nearTreeDensity).toBeGreaterThan(0.2);
      expect(s.farTreeDensity).toBeLessThan(s.nearTreeDensity / 2);
    }
  });
});
