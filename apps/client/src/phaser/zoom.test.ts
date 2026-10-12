import { VIEW, WORLD } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { defaultZoom, pinchStep, stepZoom, zoomRange } from './zoom';

const TILE_PX = WORLD.tileSizePx;

/** Tiles shown across `px` CSS pixels at `zoom`. */
const tilesAcross = (px: number, zoom: number) => px / (zoom * TILE_PX);

describe('zoomRange', () => {
  it('never shows more than the most visible tiles across the view', () => {
    for (const [w, h] of [
      [1920, 1080],
      [1280, 720],
      [2560, 1440],
      [844, 390],
      [1080, 1920],
    ] as const) {
      const { min } = zoomRange(w, h);
      expect(tilesAcross(Math.max(w, h), min)).toBeLessThanOrEqual(VIEW.maxVisibleTiles);
      expect(Number.isInteger(min)).toBe(true);
    }
  });

  it('stays within the zoom limits', () => {
    expect(zoomRange(400, 300).min).toBe(VIEW.minZoom);
    expect(zoomRange(100_000, 100).min).toBe(VIEW.maxZoom);
    expect(zoomRange(1920, 1080).max).toBe(VIEW.maxZoom);
  });
});

describe('defaultZoom', () => {
  it('shows about 40 tiles across the width', () => {
    for (const w of [1280, 1366, 1536, 1920, 2560]) {
      const zoom = defaultZoom(w, 720);
      expect(Number.isInteger(zoom)).toBe(true);
      expect(Math.abs(tilesAcross(w, zoom) - VIEW.defaultVisibleTiles)).toBeLessThan(10);
    }
  });

  it('is 4 on a 1280 px wide view and 6 on a 1920 px one', () => {
    expect(defaultZoom(1280, 720)).toBe(4);
    expect(defaultZoom(1920, 1080)).toBe(6);
  });

  it('stays in the zoom range on tiny and huge views', () => {
    expect(defaultZoom(200, 100)).toBe(VIEW.minZoom);
    expect(defaultZoom(8000, 4000)).toBe(VIEW.maxZoom);
  });
});

describe('stepZoom', () => {
  const range = { min: 2, max: 8 };

  it('moves by whole steps', () => {
    expect(stepZoom(4, 1, range)).toBe(5);
    expect(stepZoom(4, -1, range)).toBe(3);
  });

  it('stops at the range ends', () => {
    expect(stepZoom(8, 1, range)).toBe(8);
    expect(stepZoom(2, -1, range)).toBe(2);
    expect(stepZoom(1, 0, range)).toBe(2);
  });
});

describe('pinchStep', () => {
  it('zooms in when the fingers move apart enough', () => {
    expect(pinchStep(100, 100 * VIEW.pinchStepRatio)).toBe(1);
    expect(pinchStep(100, 110)).toBe(0);
  });

  it('zooms out when the fingers come closer enough', () => {
    expect(pinchStep(100, 100 / VIEW.pinchStepRatio)).toBe(-1);
    expect(pinchStep(100, 90)).toBe(0);
  });

  it('ignores a pinch without a start distance', () => {
    expect(pinchStep(0, 50)).toBe(0);
  });
});
