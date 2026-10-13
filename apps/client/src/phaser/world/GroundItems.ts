import type { Content } from '@8box/shared';
import type * as Phaser from 'phaser';
import type { RemoteView } from '../../game/world/RemoteEntities';
import { entityAnchor, sortDepth } from '../depth';
import type { SpriteTextures } from './SpriteTextures';

/** Sprite of an item whose definition the client lacks. */
const UNKNOWN_ITEM_SPRITE = 'item.unknown';

/**
 * Draws the items lying on the ground, centered on their position. They are sorted with the objects
 * (below a character standing on the same row), and never move: an item is placed once, then removed.
 */
export class GroundItems {
  private readonly images = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: SpriteTextures,
    private readonly content: Content,
  ) {}

  /** Called every frame with the entities to draw. */
  update(views: readonly RemoteView[]): void {
    const seen = new Set<number>();
    for (const view of views) {
      if (view.kind !== 'groundItem') {
        continue;
      }
      seen.add(view.id);
      if (!this.images.has(view.id)) {
        const sprite =
          (view.item && this.content.items.get(view.item)?.sprite) || UNKNOWN_ITEM_SPRITE;
        const { key, frame } = this.textures.frame(sprite);
        const anchor = entityAnchor(view);
        const image = this.scene.add
          .image(anchor.x, anchor.y, key, frame)
          .setDepth(sortDepth(anchor.y, 'object'));
        this.images.set(view.id, image);
      }
    }
    for (const [id, image] of this.images) {
      if (!seen.has(id)) {
        image.destroy();
        this.images.delete(id);
      }
    }
  }

  destroy(): void {
    for (const image of this.images.values()) {
      image.destroy();
    }
    this.images.clear();
  }
}
