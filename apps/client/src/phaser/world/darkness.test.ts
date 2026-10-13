import { LIGHT } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { darknessTint, mixColor } from './darkness';

describe('darkness', () => {
  it('mixes two colors channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0x020406, 0.5)).toBe(0x010203);
    expect(mixColor(0x102030, 0x000000, 2)).toBe(0x000000);
  });

  it('is bluish at night and orange at the start of the dusk', () => {
    expect(darknessTint(0)).toBe(LIGHT.nightTint);
    expect(darknessTint(1)).toBe(LIGHT.twilightTint);
    const dusk = darknessTint(0.7);
    expect(dusk >> 16).toBeGreaterThan(dusk & 0xff); // More red than blue.
  });
});
