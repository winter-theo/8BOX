import { chunkCoord, WORLD } from '@8box/shared';
import type * as Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import { DEPTH } from '../depth';

const TILE_PX = WORLD.tileSizePx;
/** Height of a bar with its dark frame, in pixels. */
const BAR_HEIGHT_PX = 3;
/** Width of the HP part of a bar, inside the frame, in pixels. */
const BAR_INNER_PX = TILE_PX - 2;

const color = (hex: string) => Number.parseInt(hex.slice(1), 16);

/**
 * Width of the HP part of a bar `innerPx` wide, for `hp` out of `maxHp`, in pixels: at least 1 while
 * the tile has HP left.
 */
export function damageBarFill(hp: number, maxHp: number, innerPx: number): number {
  if (hp <= 0 || maxHp <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((innerPx * Math.min(hp, maxHp)) / maxHp));
}

interface Bar {
  layer: number;
  x: number;
  y: number;
  graphics: Phaser.GameObjects.Graphics;
}

/**
 * HP bars of the tiles being broken, at the bottom of their tile, over the objects and the characters.
 * A bar goes away when the tile gets its HP back, changes (broken), or its chunk is unloaded.
 */
export class DamageBars {
  private readonly bars = new Map<string, Bar>();

  constructor(private readonly scene: Phaser.Scene) {}

  show(layer: number, x: number, y: number, hp: number, maxHp: number): void {
    const key = `${layer}:${x}:${y}`;
    if (hp >= maxHp) {
      this.remove(key);
      return;
    }
    let bar = this.bars.get(key);
    if (!bar) {
      const graphics = this.scene.add
        .graphics()
        .setDepth(DEPTH.damage)
        .setPosition(x * TILE_PX, (y + 1) * TILE_PX - BAR_HEIGHT_PX);
      bar = { layer, x, y, graphics };
      this.bars.set(key, bar);
    }
    bar.graphics
      .clear()
      .fillStyle(color(PALETTE.ink), 1)
      .fillRect(0, 0, TILE_PX, BAR_HEIGHT_PX)
      .fillStyle(color(PALETTE.berry), 1)
      .fillRect(1, 1, damageBarFill(hp, maxHp, BAR_INNER_PX), 1);
  }

  /** Tile (x, y) changed: it is no longer the one that was being broken. */
  clearTile(layer: number, x: number, y: number): void {
    this.remove(`${layer}:${x}:${y}`);
  }

  clearChunk(layer: number, cx: number, cy: number): void {
    for (const [key, bar] of this.bars) {
      if (bar.layer === layer && chunkCoord(bar.x) === cx && chunkCoord(bar.y) === cy) {
        this.remove(key);
      }
    }
  }

  destroy(): void {
    for (const key of [...this.bars.keys()]) {
      this.remove(key);
    }
  }

  private remove(key: string): void {
    this.bars.get(key)?.graphics.destroy();
    this.bars.delete(key);
  }
}
