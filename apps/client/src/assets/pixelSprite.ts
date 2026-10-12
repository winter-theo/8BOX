import type { PaletteColor } from './palette';

/** Sets one pixel of a sprite. */
export type Paint = (x: number, y: number, color: PaletteColor) => void;

export interface Placeholder {
  /** In pixels. */
  width: number;
  height: number;
  /** Relative frequency of each variant (its length is the number of variants). */
  weights: readonly number[];
  /** Draws variant `variant` (0 to weights.length - 1). Pixels left unpainted stay transparent. */
  draw(paint: Paint, variant: number): void;
}

// One string per row, one character per pixel, mapped to a color by a legend ('.' = transparent).

export type Legend = Readonly<Record<string, PaletteColor>>;

export interface PixelMap {
  weight: number;
  rows: readonly string[];
}

/** A placeholder drawn from pixel maps, one per variant; its size is the size of the first map. */
export function pixelSprite(legend: Legend, maps: readonly PixelMap[]): Placeholder {
  const rows = maps[0]?.rows ?? [];
  return {
    width: Math.max(0, ...rows.map((row) => row.length)),
    height: rows.length,
    weights: maps.map((map) => map.weight),
    draw(paint, variant) {
      const variantRows = maps[variant]?.rows ?? rows;
      variantRows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = legend[row[x] ?? '.'];
          if (color) {
            paint(x, y, color);
          }
        }
      });
    },
  };
}
