import {
  CHUNK_SIZE,
  type Chunk,
  type Content,
  chunkCoord,
  localCoord,
  tileIndex,
  tileOfCode,
  WORLD,
} from '@8box/shared';
import type * as Phaser from 'phaser';
import { type GroundLookup, planGroundTile } from '../../assets/groundArt';
import type { AssetRegistry } from '../../assets/registry';
import { DEPTH } from '../depth';

const TILE_PX = WORLD.tileSizePx;
const CHUNK_PX = CHUNK_SIZE * TILE_PX;
const LAST = CHUNK_SIZE - 1;

/** Where the layer reads the chunks around the one it draws (for the edges between grounds). */
export interface ChunkSource {
  get(layer: number, cx: number, cy: number): Chunk | undefined;
}

interface ShownChunk {
  layer: number;
  cx: number;
  cy: number;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
}

/**
 * The ground of the loaded chunks: one canvas texture per chunk, placed at whole-pixel positions so that
 * chunks meet without seams. Each tile is its ground, the edges of higher neighbor grounds and its
 * floor (see `planGroundTile`); when a chunk arrives or changes, the border tiles of its neighbors are
 * redrawn too, so that edges connect across chunks.
 */
export class GroundLayer {
  private readonly shown = new Map<string, ShownChunk>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: AssetRegistry,
    private readonly content: Content,
    private readonly source: ChunkSource,
  ) {}

  get size(): number {
    return this.shown.size;
  }

  /** Draws a chunk (or redraws it), then the neighbor tiles along its borders. */
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
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        this.drawTile(entry, lx, ly);
      }
    }
    entry.texture.refresh();
    this.redrawNeighborBorders(chunk);
  }

  /** Redraws tile (x, y) and its 8 neighbors, whose edges depend on it (after a `tileUpdate`). */
  updateTile(layer: number, x: number, y: number): void {
    const redrawn = new Set<ShownChunk>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const entry = this.shown.get(textureKey(layer, chunkCoord(x + dx), chunkCoord(y + dy)));
        if (entry) {
          this.drawTile(entry, localCoord(x + dx), localCoord(y + dy));
          redrawn.add(entry);
        }
      }
    }
    for (const entry of redrawn) {
      entry.texture.refresh();
    }
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

  /** Redraws the tiles of the 8 neighbor chunks that touch `chunk`. */
  private redrawNeighborBorders(chunk: Chunk): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighbor = this.shown.get(textureKey(chunk.layer, chunk.cx + dx, chunk.cy + dy));
        if (!neighbor || (dx === 0 && dy === 0)) {
          continue;
        }
        // The neighbor's column (or row) facing `chunk`, or its single corner tile.
        const xs = dx === 0 ? range(CHUNK_SIZE) : [dx > 0 ? 0 : LAST];
        const ys = dy === 0 ? range(CHUNK_SIZE) : [dy > 0 ? 0 : LAST];
        for (const ly of ys) {
          for (const lx of xs) {
            this.drawTile(neighbor, lx, ly);
          }
        }
        neighbor.texture.refresh();
      }
    }
  }

  private drawTile(entry: ShownChunk, lx: number, ly: number): void {
    const context = entry.texture.context;
    context.clearRect(lx * TILE_PX, ly * TILE_PX, TILE_PX, TILE_PX);
    const x = entry.cx * CHUNK_SIZE + lx;
    const y = entry.cy * CHUNK_SIZE + ly;
    for (const draw of planGroundTile(x, y, this.lookup(entry.layer))) {
      const sprite =
        this.registry.optional(draw.sprite, draw.variant) ??
        (draw.fallback === undefined
          ? undefined
          : this.registry.sprite(draw.fallback, draw.variant));
      if (sprite) {
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

  private lookup(layer: number): GroundLookup {
    return (x, y) => {
      const chunk = this.source.get(layer, chunkCoord(x), chunkCoord(y));
      if (!chunk) {
        return undefined;
      }
      const index = tileIndex(localCoord(x), localCoord(y));
      return {
        ground: tileOfCode(this.content, chunk.ground[index] ?? 0)?.sprite,
        floor: tileOfCode(this.content, chunk.floor[index] ?? 0)?.sprite,
      };
    };
  }
}

function range(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

function textureKey(layer: number, cx: number, cy: number): string {
  return `chunk:${layer}:${cx}:${cy}`;
}
