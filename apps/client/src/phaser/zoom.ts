import { VIEW, WORLD } from '@8box/shared';

const TILE_PX = WORLD.tileSizePx;

/** Whole zoom values allowed for a game view. */
export interface ZoomRange {
  min: number;
  max: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Zoom values for a game view of `widthPx` × `heightPx` CSS pixels: never more than
 * `VIEW.maxVisibleTiles` tiles across its longer side.
 */
export function zoomRange(widthPx: number, heightPx: number): ZoomRange {
  const longest = Math.max(widthPx, heightPx);
  const min = Math.ceil(longest / (VIEW.maxVisibleTiles * TILE_PX));
  return { min: clamp(min, VIEW.minZoom, VIEW.maxZoom), max: VIEW.maxZoom };
}

/** Starting zoom: about `VIEW.defaultVisibleTiles` tiles across the width of the view. */
export function defaultZoom(widthPx: number, heightPx: number): number {
  const range = zoomRange(widthPx, heightPx);
  const zoom = Math.round(widthPx / (VIEW.defaultVisibleTiles * TILE_PX));
  return clamp(zoom, range.min, range.max);
}

/** Zoom after `step` whole steps (+1 closer, -1 farther), kept in the range. */
export function stepZoom(zoom: number, step: number, range: ZoomRange): number {
  return clamp(Math.round(zoom) + step, range.min, range.max);
}

/**
 * Zoom step of a pinch: +1 when the fingers moved apart by `VIEW.pinchStepRatio` since `startDistance`,
 * -1 when they came closer by as much, 0 otherwise.
 */
export function pinchStep(startDistance: number, distance: number): number {
  if (startDistance <= 0) {
    return 0;
  }
  const ratio = distance / startDistance;
  if (ratio >= VIEW.pinchStepRatio) {
    return 1;
  }
  return ratio <= 1 / VIEW.pinchStepRatio ? -1 : 0;
}
