import * as Phaser from 'phaser';
import { drawPixelFont, fontText, PIXEL_FONT } from '../../assets/pixelFont';
import { DEPTH } from '../depth';

const FONT_KEY = 'pixel-font';
/** Gap between the top of a character and its name, in world pixels. */
const GAP_PX = 1;
/** Glyph outlines overlap by one pixel, so that letters are not too far apart. */
const LETTER_SPACING_PX = -1;

/** Registers the pixel font in Phaser once per game (a canvas texture read as a retro font). */
function ensureFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT_KEY)) {
    return;
  }
  const width = PIXEL_FONT.chars.length * PIXEL_FONT.cellWidth;
  const texture = scene.textures.createCanvas(FONT_KEY, width, PIXEL_FONT.cellHeight);
  if (!texture) {
    return;
  }
  drawPixelFont((x, y, color) => {
    texture.context.fillStyle = color;
    texture.context.fillRect(x, y, 1, 1);
  });
  texture.refresh();
  // Phaser 4 returns the whole cache entry: { data, texture, frame }.
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT_KEY,
    width: PIXEL_FONT.cellWidth,
    height: PIXEL_FONT.cellHeight,
    chars: PIXEL_FONT.chars,
    charsPerRow: PIXEL_FONT.chars.length,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(FONT_KEY, entry);
}

/**
 * Names above the heads of characters, in a pixel font scaled with the world like the rest of the art,
 * drawn over everything (a tree never hides a name).
 */
export class NameLabels {
  private readonly labels = new Map<number, Phaser.GameObjects.BitmapText>();

  constructor(private readonly scene: Phaser.Scene) {
    ensureFont(scene);
  }

  /** Shows the name of entity `id` above a sprite whose top is at `top` (world pixels). */
  set(id: number, name: string, top: { x: number; y: number }): void {
    let label = this.labels.get(id);
    const text = fontText(name);
    if (!label) {
      label = this.scene.add
        .bitmapText(0, 0, FONT_KEY, text) // Its own size: one font pixel per world pixel.
        .setLetterSpacing(LETTER_SPACING_PX)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.labels);
      this.labels.set(id, label);
    } else if (label.text !== text) {
      label.setText(text);
    }
    label.setPosition(top.x, top.y - GAP_PX);
  }

  remove(id: number): void {
    this.labels.get(id)?.destroy();
    this.labels.delete(id);
  }

  destroy(): void {
    for (const id of [...this.labels.keys()]) {
      this.remove(id);
    }
  }
}
