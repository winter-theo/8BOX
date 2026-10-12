import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { WORLD } from '../../config/world';
import { WORLDGEN } from '../../config/worldgen';
import type { Content } from '../../content/load';
import { createRng, hashCoords, hashSeed } from '../../util/rng';
import { Chunk } from '../chunk';
import { CHUNK_SIZE, LAYER, tileIndex } from '../coords';
import { EMPTY_TILE, tileCode } from '../tileCodes';

export interface SurfaceGenOptions {
  seed: number;
  content: Content;
  /** Default: WORLD.layerSizeTiles. */
  layerSizeTiles?: number;
}

export interface SurfaceGenerator {
  readonly seed: number;
  readonly layerSizeTiles: number;
  /** Center of the spawn tile, in tiles. */
  readonly spawn: { x: number; y: number };
  /** Generates one chunk from the seed and its coordinates only (no neighbor needed). */
  generateChunk(cx: number, cy: number): Chunk;
}

/** Objects a natural tile can get, tried in this order. */
const OBJECT_ORDER = ['oak', 'berryBush', 'tallGrass', 'flowers'] as const;

/** Sum of noise octaves, normalized to about [-1, 1]. */
function fbm(noise: NoiseFunction2D, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency);
    total += amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return sum / total;
}

/** 0 below `edge0`, 1 above `edge1`, smooth in between. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Surface generator: lakes from an altitude noise, rivers along a noise isoline, sand beaches and banks,
 * grass or dirt from moisture, a dense forest around the central spawn clearing and wild forests
 * elsewhere, then bushes, tall grass and flowers. Deterministic for a seed.
 */
export function createSurfaceGenerator(options: SurfaceGenOptions): SurfaceGenerator {
  const { seed, content } = options;
  const layerSizeTiles = options.layerSizeTiles ?? WORLD.layerSizeTiles;
  const g = WORLDGEN;
  const noise = (salt: string) => createNoise2D(createRng(hashSeed(`${seed}:${salt}`)).next);
  const altitudeNoise = noise('altitude');
  const riverNoise = noise('river');
  const moistureNoise = noise('moisture');
  const forestNoise = noise('forest');
  const objectSeed = hashSeed(`${seed}:objects`);

  const code = {
    grass: tileCode(content, g.tiles.grass),
    dirt: tileCode(content, g.tiles.dirt),
    sand: tileCode(content, g.tiles.sand),
    shallowWater: tileCode(content, g.tiles.shallowWater),
    deepWater: tileCode(content, g.tiles.deepWater),
    oak: tileCode(content, g.tiles.oak),
    berryBush: tileCode(content, g.tiles.berryBush),
    tallGrass: tileCode(content, g.tiles.tallGrass),
    flowers: tileCode(content, g.tiles.flowers),
  };

  const spawnTile = Math.floor(layerSizeTiles / 2);
  const spawn = { x: spawnTile + 0.5, y: spawnTile + 0.5 };
  const clearingRadius = WORLD.spawnClearingRadiusTiles;

  const groundAt = (x: number, y: number, distance: number): number => {
    if (distance <= clearingRadius) {
      return code.grass;
    }
    const lift = g.spawnLift * Math.max(0, 1 - distance / g.spawnLiftRadiusTiles);
    const altitude =
      fbm(altitudeNoise, x / g.altitudeScaleTiles, y / g.altitudeScaleTiles, g.altitudeOctaves) +
      lift;
    if (altitude < g.deepWaterLevel) {
      return code.deepWater;
    }
    if (altitude < g.shallowWaterLevel) {
      return code.shallowWater;
    }
    const riverStrength = smoothstep(
      g.riverFreeRadiusTiles,
      g.riverFreeRadiusTiles * 1.5,
      distance,
    );
    const river = Math.abs(fbm(riverNoise, x / g.riverScaleTiles, y / g.riverScaleTiles, 2));
    if (river < g.riverWidth * riverStrength) {
      return code.shallowWater;
    }
    if (altitude < g.beachLevel || river < (g.riverWidth + g.riverBankWidth) * riverStrength) {
      return code.sand;
    }
    const moisture = fbm(moistureNoise, x / g.moistureScaleTiles, y / g.moistureScaleTiles, 2);
    return moisture < g.dirtBelowMoisture ? code.dirt : code.grass;
  };

  const objectAt = (x: number, y: number, distance: number, ground: number): number => {
    if (distance <= clearingRadius || (ground !== code.grass && ground !== code.dirt)) {
      return EMPTY_TILE;
    }
    const startForest =
      1 - smoothstep(g.startForestRadiusTiles * 0.8, g.startForestRadiusTiles * 1.2, distance);
    const wildForest = smoothstep(
      g.wildForestThreshold,
      g.wildForestThreshold + 0.2,
      fbm(forestNoise, x / g.forestScaleTiles, y / g.forestScaleTiles, 2),
    );
    const forest = Math.max(startForest, wildForest);
    const chance = (key: keyof typeof g.forest) =>
      g.meadow[key] + (g.forest[key] - g.meadow[key]) * forest;

    // One roll per tile; each object owns a slice of [0, 1) as wide as its chance.
    const roll = hashCoords(objectSeed, x, y);
    let threshold = 0;
    for (const key of OBJECT_ORDER) {
      if (key === 'flowers' && ground !== code.grass) {
        continue;
      }
      threshold += chance(key);
      if (roll < threshold) {
        return code[key];
      }
    }
    return EMPTY_TILE;
  };

  return {
    seed,
    layerSizeTiles,
    spawn,
    generateChunk(cx, cy) {
      const chunk = new Chunk(LAYER.surface, cx, cy);
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const x = cx * CHUNK_SIZE + lx;
          const y = cy * CHUNK_SIZE + ly;
          const distance = Math.hypot(x - spawnTile, y - spawnTile);
          const ground = groundAt(x + 0.5, y + 0.5, distance);
          const index = tileIndex(lx, ly);
          chunk.ground[index] = ground;
          chunk.object[index] = objectAt(x, y, distance, ground);
        }
      }
      return chunk;
    },
  };
}
