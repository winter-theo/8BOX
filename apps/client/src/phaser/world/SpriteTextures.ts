import type * as Phaser from 'phaser';
import { ATLAS_KEY } from '../../assets/atlas';
import type { AssetRegistry } from '../../assets/registry';

/** The Phaser texture (and atlas frame) that shows a sprite. */
export interface TextureFrame {
  key: string;
  frame?: string;
}

/**
 * Phaser textures of the sprites shown as game objects (objects, entities): the atlas frame when the
 * atlas has the sprite, otherwise a small canvas texture per placeholder variant, made on first use.
 */
export class SpriteTextures {
  /** Placeholder image (one per variant, kept by the registry) → its texture key. */
  private readonly keys = new Map<CanvasImageSource, string>();

  constructor(
    private readonly textures: Phaser.Textures.TextureManager,
    private readonly registry: AssetRegistry,
  ) {}

  /** Whether the atlas or a placeholder has this sprite (variants that may be missing: walls…). */
  has(id: string): boolean {
    return this.registry.fromAtlas(id) || this.registry.optional(id) !== undefined;
  }

  /** Texture of a sprite; `variant` is any whole number (a tile hash…). */
  frame(id: string, variant = 0): TextureFrame {
    if (this.registry.fromAtlas(id)) {
      return { key: ATLAS_KEY, frame: id };
    }
    const source = this.registry.sprite(id, variant);
    let key = this.keys.get(source.image);
    if (key === undefined) {
      key = `sprite:${id}:${this.keys.size}`;
      const texture = this.textures.createCanvas(key, source.width, source.height);
      texture?.context.drawImage(
        source.image,
        source.sx,
        source.sy,
        source.width,
        source.height,
        0,
        0,
        source.width,
        source.height,
      );
      texture?.refresh();
      this.keys.set(source.image, key);
    }
    return { key };
  }

  /** Removes the textures made for the placeholders. */
  destroy(): void {
    for (const key of this.keys.values()) {
      this.textures.remove(key);
    }
    this.keys.clear();
  }
}
