import {
  CHUNK_SIZE,
  type Chunk,
  type Content,
  EMPTY_TILE,
  hashCoords,
  tileIndex,
  tileOfCode,
  WORLD,
} from '@8box/shared';
import type * as Phaser from 'phaser';
import type { AssetRegistry } from '../../assets/registry';
import { DEPTH } from '../depth';

const TILE_PX = WORLD.tileSizePx;
const CHUNK_PX = CHUNK_SIZE * TILE_PX;
/** Seed of the per-tile placeholder variants (any fixed number: same tile → same look). */
const VARIANT_SEED = 0x8b0c;

interface ShownChunk {
  layer: number;
  cx: number;
  cy: number;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
}

/**
 * The ground of the loaded chunks (`ground` then `floor` slots): one canvas texture per chunk, placed at
 * whole-pixel positions so that chunks meet without seams. A chunk is redrawn when one of its tiles
 * changes.
 */
export class GroundLayer {
  private readonly shown = new Map<string, ShownChunk>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: AssetRegistry,
    private readonly content: Content,
  ) {}

  get size(): number {
    return this.shown.size;
  }

  /** Draws a chunk, or redraws it if it is already shown. */
  show(chunk: Chunk): void {
    const key = textureKey(chunk.layer, chunk.cx, chunk.cy);
    let entry = this.shown.get(key);
    if (!entry) {
      const texture = this.scene.textures.createCanvas(key, CHUNK_PX, CHUNK_PX);
      if (!texture) {
        return;
      }
      const image = this.scene.add
        .image(chunk.cx * CHUNK_PX, chunk.cy * CHUNK_PX, key)
        .setOrigin(0, 0)
        .setDepth(DEPTH.ground);
      entry = { layer: chunk.layer, cx: chunk.cx, cy: chunk.cy, texture, image };
      this.shown.set(key, entry);
    }
    this.draw(entry.texture.context, chunk);
    entry.texture.refresh();
  }

  hide(layer: number, cx: number, cy: number): void {
    const key = textureKey(layer, cx, cy);
    const entry = this.shown.get(key);
    if (entry) {
      entry.image.destroy();
      this.scene.textures.remove(key);
      this.shown.delete(key);
    }
  }

  destroy(): void {
    for (const { layer, cx, cy } of [...this.shown.values()]) {
      this.hide(layer, cx, cy);
    }
  }

  private draw(context: CanvasRenderingContext2D, chunk: Chunk): void {
    context.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const index = tileIndex(lx, ly);
        const x = chunk.cx * CHUNK_SIZE + lx;
        const y = chunk.cy * CHUNK_SIZE + ly;
        const variant = Math.floor(hashCoords(VARIANT_SEED, x, y) * 1024);
        for (const code of [chunk.ground[index], chunk.floor[index]]) {
          const tile =
            code === undefined || code === EMPTY_TILE ? undefined : tileOfCode(this.content, code);
          if (!tile) {
            continue;
          }
          const sprite = this.registry.sprite(tile.sprite, variant);
          context.drawImage(
            sprite.image,
            sprite.sx,
            sprite.sy,
            TILE_PX,
            TILE_PX,
            lx * TILE_PX,
            ly * TILE_PX,
            TILE_PX,
            TILE_PX,
          );
        }
      }
    }
  }
}

function textureKey(layer: number, cx: number, cy: number): string {
  return `chunk:${layer}:${cx}:${cy}`;
}
