import { LIGHT } from '@8box/shared';

/** Color between `from` (t = 0) and `to` (t = 1), channel by channel, as 0xRRGGBB. */
export function mixColor(from: number, to: number, t: number): number {
  const share = Math.min(1, Math.max(0, t));
  let color = 0;
  for (const shift of [16, 8, 0]) {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    color |= Math.round(a + (b - a) * share) << shift;
  }
  return color;
}

/**
 * Color of the darkness for a share of daylight (0 night, 1 day): orange while the light is still
 * high (dawn, dusk), bluish as it gets dark.
 */
export function darknessTint(daylight: number): number {
  const dark = 1 - daylight;
  return mixColor(LIGHT.twilightTint, LIGHT.nightTint, dark * dark);
}
