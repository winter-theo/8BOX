import type * as Phaser from 'phaser';
import { entityAnchor, sortDepth } from '../depth';
import type { SpriteTextures } from './SpriteTextures';

/**
 * The entities of the world (players, animals, monsters…): one sprite each, anchored at its feet and
 * sorted by Y with the objects, so that a tree's foliage hides a character behind it.
 */
export class EntityLayer {
  private readonly sprites = new Map<number, { sprite: string; image: Phaser.GameObjects.Image }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: SpriteTextures,
  ) {}

  /** Shows an entity or moves it; `position` is in tiles (its feet). Returns its sprite. */
  set(id: number, sprite: string, position: { x: number; y: number }): Phaser.GameObjects.Image {
    let entry = this.sprites.get(id);
    if (!entry) {
      const { key, frame } = this.textures.frame(sprite);
      entry = { sprite, image: this.scene.add.image(0, 0, key, frame).setOrigin(0.5, 1) };
      this.sprites.set(id, entry);
    } else if (entry.sprite !== sprite) {
      const { key, frame } = this.textures.frame(sprite);
      entry.image.setTexture(key, frame);
      entry.sprite = sprite;
    }
    const anchor = entityAnchor(position);
    return entry.image.setPosition(anchor.x, anchor.y).setDepth(sortDepth(anchor.y, 'entity'));
  }

  remove(id: number): void {
    this.sprites.get(id)?.image.destroy();
    this.sprites.delete(id);
  }

  destroy(): void {
    for (const id of [...this.sprites.keys()]) {
      this.remove(id);
    }
  }
}
