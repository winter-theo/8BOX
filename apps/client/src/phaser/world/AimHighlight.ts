import { WORLD } from '@8box/shared';
import type * as Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { DEPTH } from '../depth';

const TILE_PX = WORLD.tileSizePx;
/** Opacity of the outline (no unit). */
const OUTLINE_ALPHA = 0.85;

/** Outlines the tile the player aims at, one pixel thick, over the objects and the characters. */
export class AimHighlight {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private shown: { x: number; y: number } | undefined;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.aim);
    this.graphics.lineStyle(1, Number.parseInt(PALETTE.bone.slice(1), 16), OUTLINE_ALPHA);
    // Half a pixel in, so that the line covers whole pixels inside the tile.
    this.graphics.strokeRect(0.5, 0.5, TILE_PX - 1, TILE_PX - 1);
    this.graphics.setVisible(false);
  }

  /** Called every frame with the aimed tile, or undefined when there is none. */
  update(tile: { x: number; y: number } | undefined): void {
    if (tile?.x === this.shown?.x && tile?.y === this.shown?.y) {
      return;
    }
    this.shown = tile;
    this.graphics.setVisible(tile !== undefined);
    if (tile) {
      this.graphics.setPosition(tile.x * TILE_PX, tile.y * TILE_PX);
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
