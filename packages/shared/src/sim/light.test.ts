import { describe, expect, it } from 'vitest';
import { LIGHT } from '../config/light';
import { TIME } from '../config/time';
import type { TileDef } from '../content/schemas';
import { ambientLight, isLit, type LightWorld, lightLevel, sourceLight } from './light';

const NIGHT_MS = TIME.daytimeMs + TIME.twilightMs;
const DAY_MS = TIME.twilightMs;

function source(radiusTiles: number): TileDef {
  return { light: { radiusTiles } } as TileDef;
}

/** A world with light sources at the given tiles. */
function worldWith(sources: Record<string, number>): LightWorld {
  return {
    objectAt: (x, y) => {
      const radius = sources[`${x},${y}`];
      return radius === undefined ? undefined : source(radius);
    },
  };
}

describe('light', () => {
  it('fades with the distance to a source, down to 0 at its radius', () => {
    expect(sourceLight(0, 6)).toBe(1);
    expect(sourceLight(3, 6)).toBeCloseTo(0.75);
    expect(sourceLight(6, 6)).toBe(0);
    expect(sourceLight(8, 6)).toBe(0);
    expect(sourceLight(1, 0)).toBe(0);
  });

  it('follows the daylight: full by day, dim at night, in between at dusk', () => {
    expect(ambientLight(DAY_MS)).toBe(1);
    expect(ambientLight(NIGHT_MS)).toBeCloseTo(LIGHT.nightAmbient);
    const dusk = ambientLight(TIME.daytimeMs + TIME.twilightMs / 2);
    expect(dusk).toBeGreaterThan(LIGHT.nightAmbient);
    expect(dusk).toBeLessThan(1);
  });

  it('keeps the brightest of the ambient light and of several sources', () => {
    const world = worldWith({ '0,0': 6, '4,0': 2 });
    // (3, 0): 3 tiles from the torch (0.75), 1 tile from the small source (0.75).
    expect(lightLevel(world, 3, 0, NIGHT_MS)).toBeCloseTo(0.75);
    // (4, 0): on the small source.
    expect(lightLevel(world, 4, 0, NIGHT_MS)).toBe(1);
    // (5, 0): 5 tiles from the torch (1 − 25/36), 1 tile from the small source (0.75).
    expect(lightLevel(world, 5, 0, NIGHT_MS)).toBeCloseTo(0.75);
    // Far from both: the night ambient light.
    expect(lightLevel(world, 20, 20, NIGHT_MS)).toBeCloseTo(LIGHT.nightAmbient);
    // By day, everything is fully lit.
    expect(lightLevel(world, 20, 20, DAY_MS)).toBe(1);
  });

  it('tells which tiles are lit: by day all, at night near a source', () => {
    const world = worldWith({ '10,10': LIGHT.defaultRadiusTiles });
    expect(isLit(world, 30, 30, DAY_MS)).toBe(true);
    expect(isLit(world, 30, 30, NIGHT_MS)).toBe(false);
    expect(isLit(world, 10, 10, NIGHT_MS)).toBe(true);
    expect(isLit(world, 15, 10, NIGHT_MS)).toBe(true);
    expect(isLit(world, 16, 10, NIGHT_MS)).toBe(false);
  });

  it('does not see sources beyond the largest radius', () => {
    const far = LIGHT.maxRadiusTiles + 1;
    const world = worldWith({ [`${far},0`]: 100 });
    expect(lightLevel(world, 0, 0, NIGHT_MS)).toBeCloseTo(LIGHT.nightAmbient);
  });
});
