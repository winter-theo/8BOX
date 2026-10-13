import { PALETTE } from './palette';
import { type Legend, type Placeholder, pixelSprite } from './pixelSprite';

const P = PALETTE;

// HUD icons are 8 × 8, each worth 2 points of a gauge: full, half (left half) and empty.

const HUD: Legend = {
  o: P.ink,
  r: P.berry,
  w: P.bone,
  b: P.soilLight,
  d: P.soil,
  e: P.slate,
};

/** Letters that fill an icon (the outline `o` stays). */
const FILL = /[rwbd]/g;

const HEART = [
  '.oo..oo.',
  'owroorro',
  'orrrrrro',
  'orrrrrro',
  '.orrrro.',
  '..orro..',
  '...oo...',
  '........',
];

const DRUMSTICK = [
  '...ooo..',
  '..obbbo.',
  '.obbbbdo',
  '.obbbddo',
  '.owbddo.',
  'owwooo..',
  'ow......',
  '.o......',
];

/** The icon with its right half (from column 4) emptied. */
function half(rows: readonly string[]): string[] {
  return rows.map((row) => row.slice(0, 4) + row.slice(4).replace(FILL, 'e'));
}

/** The icon emptied. */
function empty(rows: readonly string[]): string[] {
  return rows.map((row) => row.replace(FILL, 'e'));
}

/** Full, half and empty icons of a gauge: `<id>.full`, `<id>.half`, `<id>.empty`. */
function gauge(id: string, rows: readonly string[]): Record<string, Placeholder> {
  const icon = (iconRows: readonly string[]) => pixelSprite(HUD, [{ weight: 1, rows: iconRows }]);
  return {
    [`${id}.full`]: icon(rows),
    [`${id}.half`]: icon(half(rows)),
    [`${id}.empty`]: icon(empty(rows)),
  };
}

/** Placeholders of the HUD icons, by sprite id: hearts (health) and drumsticks (hunger). */
export const HUD_PLACEHOLDERS: Readonly<Record<string, Placeholder>> = {
  ...gauge('hud.heart', HEART),
  ...gauge('hud.hunger', DRUMSTICK),
};
