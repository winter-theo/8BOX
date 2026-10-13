import { describe, expect, it } from 'vitest';
import { WORLD } from '../config/world';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { createSurfaceGenerator } from './gen/surface';
import { inSafeZone, spawnPoint, spawnSafeZone } from './safeZone';

describe('safe zone', () => {
  it('is centered on the spawn of the surface generator', () => {
    const content = loadContent(baseContent);
    const generator = createSurfaceGenerator({ seed: 1, content, layerSizeTiles: 64 });
    expect(spawnPoint(64)).toEqual(generator.spawn);
    expect(spawnPoint(WORLD.layerSizeTiles)).toEqual({ x: 512.5, y: 512.5 });
  });

  it('holds the tiles whose center is closer than the radius, on the surface only', () => {
    const zone = spawnSafeZone(WORLD.layerSizeTiles, WORLD.safeZoneRadiusTiles);
    expect(zone).toEqual({ layer: 0, x: 512.5, y: 512.5, radiusTiles: 32 });
    expect(inSafeZone(zone, 0, 512, 512)).toBe(true);
    expect(inSafeZone(zone, 0, 512 + 31, 512)).toBe(true);
    expect(inSafeZone(zone, 0, 512 + 32, 512)).toBe(false);
    expect(inSafeZone(zone, 0, 512 - 32, 512)).toBe(false);
    // On a diagonal, 23 tiles each way is 32.5 tiles away: outside.
    expect(inSafeZone(zone, 0, 512 + 22, 512 + 22)).toBe(true);
    expect(inSafeZone(zone, 0, 512 + 23, 512 + 23)).toBe(false);
    expect(inSafeZone(zone, 1, 512, 512)).toBe(false);
  });
});
