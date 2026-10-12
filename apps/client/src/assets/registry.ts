import { MISSING_PLACEHOLDER, type Placeholder, placeholderFor } from './placeholders';

/** Where to copy a sprite from: a region of an image. */
export interface SpriteSource {
  image: CanvasImageSource;
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/** A loaded atlas: its image and one frame per sprite id. */
export interface Atlas {
  image: CanvasImageSource;
  frames: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>;
}

/** Creates a small canvas to draw a placeholder into (a DOM canvas in the browser). */
export type CanvasFactory = (
  width: number,
  height: number,
) => {
  image: CanvasImageSource;
  context: Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'>;
};

const domCanvas: CanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas unavailable');
  }
  return { image: canvas, context };
};

/**
 * Sprite id → image. The atlas frame when the atlas has it, otherwise a placeholder drawn by code.
 * Game code never uses image paths: replacing the art means shipping an atlas.
 */
export class AssetRegistry {
  private readonly drawn = new Map<string, SpriteSource[]>();

  constructor(
    private readonly atlas: Atlas | undefined,
    private readonly createCanvas: CanvasFactory = domCanvas,
  ) {}

  /** Image of a sprite; `variant` is any whole number (placeholders pick one of their variants). */
  sprite(id: string, variant = 0): SpriteSource {
    const frame = this.atlas?.frames.get(id);
    if (this.atlas && frame) {
      return {
        image: this.atlas.image,
        sx: frame.x,
        sy: frame.y,
        width: frame.width,
        height: frame.height,
      };
    }
    const variants = this.placeholderImages(id);
    return variants[Math.abs(variant) % variants.length] ?? (variants[0] as SpriteSource);
  }

  /** Whether a sprite comes from the atlas (and not from a placeholder). */
  fromAtlas(id: string): boolean {
    return this.atlas?.frames.has(id) ?? false;
  }

  private placeholderImages(id: string): SpriteSource[] {
    let images = this.drawn.get(id);
    if (!images) {
      const placeholder: Placeholder = placeholderFor(id) ?? MISSING_PLACEHOLDER;
      images = Array.from({ length: placeholder.variants }, (_, variant) => {
        const { image, context } = this.createCanvas(placeholder.width, placeholder.height);
        placeholder.draw((x, y, color) => {
          context.fillStyle = color;
          context.fillRect(x, y, 1, 1);
        }, variant);
        return { image, sx: 0, sy: 0, width: placeholder.width, height: placeholder.height };
      });
      this.drawn.set(id, images);
    }
    return images;
  }
}
