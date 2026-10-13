import { LAYER } from './coords';

/** A disc of a layer where nothing is broken nor built (except by an admin). */
export interface SafeZone {
  layer: number;
  /** Center, in tiles. */
  x: number;
  y: number;
  /** In tiles. */
  radiusTiles: number;
}

/** Center of the spawn tile: the middle of the surface, in tiles. */
export function spawnPoint(layerSizeTiles: number): { x: number; y: number } {
  const tile = Math.floor(layerSizeTiles / 2);
  return { x: tile + 0.5, y: tile + 0.5 };
}

/** The safe zone around the spawn point of a surface of this size. */
export function spawnSafeZone(layerSizeTiles: number, radiusTiles: number): SafeZone {
  return { layer: LAYER.surface, ...spawnPoint(layerSizeTiles), radiusTiles };
}

/** Whether tile (x, y) of a layer is in the safe zone: its center is closer than the radius. */
export function inSafeZone(zone: SafeZone, layer: number, x: number, y: number): boolean {
  return layer === zone.layer && Math.hypot(x + 0.5 - zone.x, y + 0.5 - zone.y) < zone.radiusTiles;
}
