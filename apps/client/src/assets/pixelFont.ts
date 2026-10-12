import { PALETTE, type PaletteColor } from './palette';
import type { Paint } from './pixelSprite';

/** Glyphs of 3 × 6 pixels: rows 0 to 4 hold capitals and digits, row 5 the descenders. */
const GLYPHS: Readonly<Record<string, string>> = {
  A: '.#./#.#/###/#.#/#.#/...',
  B: '##./#.#/##./#.#/##./...',
  C: '.##/#../#../#../.##/...',
  D: '##./#.#/#.#/#.#/##./...',
  E: '###/#../##./#../###/...',
  F: '###/#../##./#../#../...',
  G: '.##/#../#.#/#.#/.##/...',
  H: '#.#/#.#/###/#.#/#.#/...',
  I: '###/.#./.#./.#./###/...',
  J: '..#/..#/..#/#.#/.#./...',
  K: '#.#/#.#/##./#.#/#.#/...',
  L: '#../#../#../#../###/...',
  M: '#.#/###/#.#/#.#/#.#/...',
  N: '##./#.#/#.#/#.#/#.#/...',
  O: '.#./#.#/#.#/#.#/.#./...',
  P: '##./#.#/##./#../#../...',
  Q: '.#./#.#/#.#/##./.##/...',
  R: '##./#.#/##./#.#/#.#/...',
  S: '.##/#../.#./..#/##./...',
  T: '###/.#./.#./.#./.#./...',
  U: '#.#/#.#/#.#/#.#/###/...',
  V: '#.#/#.#/#.#/#.#/.#./...',
  W: '#.#/#.#/#.#/###/#.#/...',
  X: '#.#/#.#/.#./#.#/#.#/...',
  Y: '#.#/#.#/.#./.#./.#./...',
  Z: '###/..#/.#./#../###/...',
  a: '.../.##/#.#/#.#/.##/...',
  b: '#../##./#.#/#.#/##./...',
  c: '.../.##/#../#../.##/...',
  d: '..#/.##/#.#/#.#/.##/...',
  e: '.../.#./###/#../.##/...',
  f: '.##/#../##./#../#../...',
  g: '.../.##/#.#/.##/..#/##.',
  h: '#../##./#.#/#.#/#.#/...',
  i: '.#./.../.#./.#./.#./...',
  j: '..#/.../..#/..#/#.#/.#.',
  k: '#../#.#/##./##./#.#/...',
  l: '#../#../#../#../.##/...',
  m: '.../##./###/#.#/#.#/...',
  n: '.../##./#.#/#.#/#.#/...',
  o: '.../.#./#.#/#.#/.#./...',
  p: '.../##./#.#/##./#../#..',
  q: '.../.##/#.#/.##/..#/..#',
  r: '.../#.#/##./#../#../...',
  s: '.../.##/##./..#/##./...',
  t: '.#./###/.#./.#./..#/...',
  u: '.../#.#/#.#/#.#/.##/...',
  v: '.../#.#/#.#/#.#/.#./...',
  w: '.../#.#/#.#/###/#.#/...',
  x: '.../#.#/.#./.#./#.#/...',
  y: '.../#.#/#.#/.##/..#/##.',
  z: '.../###/.#./#../###/...',
  '0': '###/#.#/#.#/#.#/###/...',
  '1': '.#./##./.#./.#./###/...',
  '2': '##./..#/.#./#../###/...',
  '3': '##./..#/.#./..#/##./...',
  '4': '#.#/#.#/###/..#/..#/...',
  '5': '###/#../##./..#/##./...',
  '6': '.##/#../###/#.#/###/...',
  '7': '###/..#/.#./.#./.#./...',
  '8': '###/#.#/###/#.#/###/...',
  '9': '###/#.#/###/..#/##./...',
  _: '.../.../.../.../.../###',
  '?': '##./..#/.#./.../.#./...',
  ' ': '.../.../.../.../.../...',
};

const GLYPH_WIDTH = 3;
const GLYPH_HEIGHT = 6;
/** Dark border around each glyph, so that names stay readable on any ground, in pixels. */
const OUTLINE = 1;

/** The font as a sheet of fixed-size cells, one per character, in a single row. */
export const PIXEL_FONT = {
  chars: Object.keys(GLYPHS).join(''),
  cellWidth: GLYPH_WIDTH + 2 * OUTLINE,
  cellHeight: GLYPH_HEIGHT + 2 * OUTLINE,
  /** Shown for a character the font does not have. */
  fallback: '?',
  color: PALETTE.bone as PaletteColor,
  outline: PALETTE.ink as PaletteColor,
} as const;

/** Pixels of a glyph: one string per row, '#' for ink. */
export function glyphRows(char: string): string[] {
  return (GLYPHS[char] ?? GLYPHS[PIXEL_FONT.fallback] ?? '').split('/');
}

/** Replaces the characters the font lacks, so that the text draws without holes. */
export function fontText(text: string): string {
  return [...text].map((char) => (char in GLYPHS ? char : PIXEL_FONT.fallback)).join('');
}

/** Draws the whole sheet: each glyph in its cell, with its outline. */
export function drawPixelFont(paint: Paint): void {
  [...PIXEL_FONT.chars].forEach((char, index) => {
    const rows = glyphRows(char);
    const left = index * PIXEL_FONT.cellWidth + OUTLINE;
    const ink = (x: number, y: number) => rows[y]?.[x] === '#';
    for (let y = -OUTLINE; y < GLYPH_HEIGHT + OUTLINE; y++) {
      for (let x = -OUTLINE; x < GLYPH_WIDTH + OUTLINE; x++) {
        if (ink(x, y)) {
          paint(left + x, OUTLINE + y, PIXEL_FONT.color);
        } else if (ink(x - 1, y) || ink(x + 1, y) || ink(x, y - 1) || ink(x, y + 1)) {
          paint(left + x, OUTLINE + y, PIXEL_FONT.outline);
        }
      }
    }
  });
}
