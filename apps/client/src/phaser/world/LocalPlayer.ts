import type * as Phaser from 'phaser';
import type { LocalView } from '../../game/player/LocalPlayerState';
import { characterFrame, characterSprite, type Side, spriteSide } from '../character';
import type { EntityLayer } from './EntityLayer';

/**
 * Draws the player of this client where the prediction puts it, in its skin: it walks while it moves,
 * and turns left or right with its facing.
 */
export class LocalPlayer {
  private entity: number | undefined;
  private side: Side = 'right';

  constructor(private readonly entities: EntityLayer) {}

  /** Called every frame. Returns the player's sprite, or undefined when it is not in the world. */
  update(view: LocalView | undefined, timeMs: number): Phaser.GameObjects.Image | undefined {
    if (this.entity !== undefined && this.entity !== view?.entity) {
      this.entities.remove(this.entity);
      this.entity = undefined;
    }
    if (!view) {
      return undefined;
    }
    this.entity = view.entity;
    this.side = spriteSide(view.facing, this.side);
    const sprite = characterSprite(view.skin, characterFrame(view.moving, timeMs));
    return this.entities.set(view.entity, sprite, view, this.side === 'left');
  }
}
