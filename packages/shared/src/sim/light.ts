import { LIGHT } from '../config/light';
import { TIME } from '../config/time';
import type { TileDef } from '../content/schemas';
import { type DayCycle, daylight } from './time';

/** The tiles as light sees them: light sources are objects with a `light`. */
export interface LightWorld {
  /** Object on tile (x, y); undefined when there is none, or outside the world (or not loaded). */
  objectAt(x: number, y: number): TileDef | undefined;
}

/** Light values (`LIGHT`). */
export interface LightConfig {
  nightAmbient: number;
  maxRadiusTiles: number;
  litThreshold: number;
}

/** Light of the sky, from `nightAmbient` at night to 1 by day, following the daylight. */
export function ambientLight(
  worldTimeMs: number,
  cycle: DayCycle = TIME,
  light: LightConfig = LIGHT,
): number {
  return light.nightAmbient + (1 - light.nightAmbient) * daylight(worldTimeMs, cycle);
}

/**
 * Light a source gives `distanceTiles` away: 1 on it, then 1 − (d / radius)², down to 0 at its radius.
 */
export function sourceLight(distanceTiles: number, radiusTiles: number): number {
  if (radiusTiles <= 0) {
    return 0;
  }
  const ratio = distanceTiles / radiusTiles;
  return ratio >= 1 ? 0 : 1 - ratio * ratio;
}

/**
 * Light the sources give tile (x, y): the brightest of them, with distances between tile centres.
 * Sources further than `maxRadiusTiles` are not seen.
 */
export function sourcesLight(
  world: LightWorld,
  x: number,
  y: number,
  light: LightConfig = LIGHT,
): number {
  const reach = Math.ceil(light.maxRadiusTiles);
  let brightest = 0;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const radius = world.objectAt(x + dx, y + dy)?.light?.radiusTiles;
      if (radius !== undefined) {
        brightest = Math.max(brightest, sourceLight(Math.hypot(dx, dy), radius));
      }
    }
  }
  return brightest;
}

/** Light level of tile (x, y), from 0 to 1: the most of the ambient light and of the sources. */
export function lightLevel(
  world: LightWorld,
  x: number,
  y: number,
  worldTimeMs: number,
  cycle: DayCycle = TIME,
  light: LightConfig = LIGHT,
): number {
  const ambient = ambientLight(worldTimeMs, cycle, light);
  return ambient >= 1 ? 1 : Math.max(ambient, sourcesLight(world, x, y, light));
}

/**
 * Whether tile (x, y) is lit (`litThreshold`) at world time `worldTimeMs`: no monster appears on a
 * lit tile (step 23). By day, every tile is.
 */
export function isLit(
  world: LightWorld,
  x: number,
  y: number,
  worldTimeMs: number,
  cycle: DayCycle = TIME,
  light: LightConfig = LIGHT,
): boolean {
  if (ambientLight(worldTimeMs, cycle, light) >= light.litThreshold) {
    return true;
  }
  return sourcesLight(world, x, y, light) >= light.litThreshold;
}
