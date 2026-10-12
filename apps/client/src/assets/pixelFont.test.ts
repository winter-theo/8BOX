import { describe, expect, it } from 'vitest';
import { PALETTE } from './palette';
import { drawPixelFont, fontText, glyphRows, PIXEL_FONT } from './pixelFont';

describe('pixel font', () => {
  it('has a 3 × 6 glyph for every character of a player name', () => {
    const nameChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    for (const char of nameChars) {
      expect(PIXEL_FONT.chars, char).toContain(char);
      const rows = glyphRows(char);
      expect(rows, char).toHaveLength(6);
      expect(
        rows.every((row) => row.length === 3),
        char,
      ).toBe(true);
    }
  });

  it('gives each letter its own shape', () => {
    const shapes = new Set([...PIXEL_FONT.chars].map((char) => glyphRows(char).join('/')));
    expect(shapes.size).toBe(PIXEL_FONT.chars.length);
  });

  it('replaces unknown characters', () => {
    expect(fontText('Ana-é')).toBe('Ana??');
  });

  it('draws each glyph inside its cell, outlined', () => {
    const pixels = new Map<string, string>();
    drawPixelFont((x, y, color) => pixels.set(`${x},${y}`, color));
    const width = PIXEL_FONT.chars.length * PIXEL_FONT.cellWidth;
    for (const key of pixels.keys()) {
      const [x, y] = key.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(PIXEL_FONT.cellHeight);
    }
    // 'A' is the first cell: its top pixel is ink, with outline above it.
    expect(pixels.get('2,1')).toBe(PALETTE.bone);
    expect(pixels.get('2,0')).toBe(PALETTE.ink);
  });
});
