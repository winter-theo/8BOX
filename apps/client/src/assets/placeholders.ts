import { PALETTE, type PaletteColor } from './palette';

/** Sets one pixel of a sprite. */
export type Paint = (x: number, y: number, color: PaletteColor) => void;

export interface Placeholder {
  /** In pixels. */
  width: number;
  height: number;
  /** Number of variants (picked per tile so that large areas do not look like a grid). */
  variants: number;
  draw(paint: Paint, variant: number): void;
}

const TILE = 8;

function fill(paint: Paint, color: PaletteColor, width = TILE, height = TILE): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      paint(x, y, color);
    }
  }
}

function dots(
  paint: Paint,
  color: PaletteColor,
  points: readonly (readonly [number, number])[],
): void {
  for (const [x, y] of points) {
    paint(x, y, color);
  }
}

/** Grass tufts: a small "v" of two pixels, at a few spots per variant. */
const GRASS_TUFTS: readonly (readonly [number, number])[][] = [
  [
    [1, 1],
    [5, 4],
    [2, 6],
  ],
  [
    [4, 1],
    [1, 4],
    [6, 6],
  ],
  [
    [6, 2],
    [2, 3],
    [4, 6],
  ],
];

/** Hand-drawn placeholders by sprite id, in the palette. */
const PLACEHOLDERS: Record<string, Placeholder> = {
  'ground.grass': {
    width: TILE,
    height: TILE,
    variants: GRASS_TUFTS.length,
    draw(paint, variant) {
      fill(paint, PALETTE.green);
      for (const [x, y] of GRASS_TUFTS[variant % GRASS_TUFTS.length] ?? []) {
        paint(x, y, PALETTE.darkGreen);
        paint(x + 1, y + 1, PALETTE.darkGreen);
      }
    },
  },
  'ground.dirt': {
    width: TILE,
    height: TILE,
    variants: 2,
    draw(paint, variant) {
      fill(paint, PALETTE.brown);
      dots(
        paint,
        PALETTE.darkGray,
        variant === 0
          ? [
              [1, 2],
              [5, 1],
              [3, 5],
              [6, 6],
            ]
          : [
              [2, 1],
              [6, 3],
              [1, 6],
              [4, 4],
            ],
      );
    },
  },
  'ground.sand': {
    width: TILE,
    height: TILE,
    variants: 2,
    draw(paint, variant) {
      fill(paint, PALETTE.peach);
      dots(
        paint,
        PALETTE.orange,
        variant === 0
          ? [
              [1, 1],
              [5, 2],
              [2, 5],
              [6, 6],
            ]
          : [
              [3, 1],
              [0, 4],
              [5, 5],
              [7, 2],
            ],
      );
    },
  },
  'ground.shallow_water': {
    width: TILE,
    height: TILE,
    variants: 2,
    draw(paint, variant) {
      fill(paint, PALETTE.blue);
      const row = variant === 0 ? 2 : 5;
      dots(paint, PALETTE.white, [
        [1, row],
        [2, row],
        [5, row + 1],
        [6, row + 1],
      ]);
    },
  },
  'ground.deep_water': {
    width: TILE,
    height: TILE,
    variants: 2,
    draw(paint, variant) {
      fill(paint, PALETTE.darkBlue);
      const row = variant === 0 ? 3 : 6;
      dots(paint, PALETTE.blue, [
        [1, row],
        [2, row],
        [3, row],
        [5, row - 2],
        [6, row - 2],
      ]);
    },
  },
};

/** Drawn for a sprite id with neither an atlas frame nor a placeholder: a loud checker. */
export const MISSING_PLACEHOLDER: Placeholder = {
  width: TILE,
  height: TILE,
  variants: 1,
  draw(paint) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        paint(x, y, (x >> 2) % 2 === (y >> 2) % 2 ? PALETTE.pink : PALETTE.black);
      }
    }
  },
};

export function placeholderFor(spriteId: string): Placeholder | undefined {
  return PLACEHOLDERS[spriteId];
}
