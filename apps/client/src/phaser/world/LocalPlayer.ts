import { type Facing, VIEW } from '@8box/shared';
import type * as Phaser from 'phaser';
import { characterFrame, characterSprite, type Side, spriteSide } from '../character';
import type { EntityLayer } from './EntityLayer';

/** Skin of every player until custom skins (P11). */
const DEFAULT_SKIN = 'default';

/**
 * The player of this client, drawn where the server says it is (prediction comes with step 08): it
 * walks while its position changes, and turns left or right with its facing.
 */
export class LocalPlayer {
  private entity: number | undefined;
  private position = { x: 0, y: 0 };
  private side: Side = 'right';
  /** Scene time of the last position change, in ms. */
  private lastMovedAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly entities: EntityLayer) {}

  /** Shows the player at its spawn (a new connection replaces the previous entity). Returns its sprite. */
  spawn(entity: number, position: { x: number; y: number }): Phaser.GameObjects.Image {
    if (this.entity !== undefined && this.entity !== entity) {
      this.entities.remove(this.entity);
    }
    this.entity = entity;
    this.position = { x: position.x, y: position.y };
    this.lastMovedAt = Number.NEGATIVE_INFINITY;
    return this.draw(0);
  }

  /** The player left the world: its sprite goes. */
  remove(): void {
    if (this.entity !== undefined) {
      this.entities.remove(this.entity);
      this.entity = undefined;
    }
  }

  /** A server snapshot: new position and facing. */
  move(x: number, y: number, facing: Facing, timeMs: number): void {
    if (x !== this.position.x || y !== this.position.y) {
      this.position = { x, y };
      this.lastMovedAt = timeMs;
    }
    this.side = spriteSide(facing, this.side);
  }

  /** Called every frame: position and animation frame. */
  update(timeMs: number): void {
    if (this.entity !== undefined) {
      this.draw(timeMs);
    }
  }

  private draw(timeMs: number): Phaser.GameObjects.Image {
    // Walking until no move came for a frame duration (snapshots come every tick).
    const moving = timeMs - this.lastMovedAt < VIEW.walkFrameMs;
    const sprite = characterSprite(DEFAULT_SKIN, characterFrame(moving, timeMs));
    return this.entities.set(this.entity ?? 0, sprite, this.position, this.side === 'left');
  }
}
