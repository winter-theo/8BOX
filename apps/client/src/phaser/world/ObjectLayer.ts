import {
  CHUNK_SIZE,
  type Chunk,
  type Content,
  chunkCoord,
  EMPTY_TILE,
  localCoord,
  tileIndex,
  tileOfCode,
} from '@8box/shared';
import type * as Phaser from 'phaser';
import { objectVariant } from '../../assets/objectArt';
import { objectAnchor, sortDepth } from '../depth';
import type { SpriteTextures } from './SpriteTextures';

const TILES_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE;

/**
 * The objects of the loaded chunks (trees, bushes, walls…): one sprite per tile, anchored at the bottom of
 * its tile and sorted by Y with the entities. Sprites of a chunk that leaves go back to a pool and are
 * reused for the next chunks, so streaming creates few game objects.
 */
export class ObjectLayer {
  /** Hidden sprites, ready to be reused. */
  private readonly pool: Phaser.GameObjects.Image[] = [];
  /** Chunk key → tile index → sprite of its object. */
  private readonly shown = new Map<string, Map<number, Phaser.GameObjects.Image>>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: SpriteTextures,
    private readonly content: Content,
  ) {}

  /** Sprites in use and in the pool (dev info). */
  get counts(): { shown: number; pooled: number } {
    let shown = 0;
    for (const sprites of this.shown.values()) {
      shown += sprites.size;
    }
    return { shown, pooled: this.pool.length };
  }

  /** Places the objects of a chunk (or places them again when the chunk was replaced). */
  show(chunk: Chunk): void {
    const key = chunkKey(chunk.layer, chunk.cx, chunk.cy);
    let sprites = this.shown.get(key);
    if (sprites) {
      this.releaseAll(sprites);
    } else {
      sprites = new Map();
      this.shown.set(key, sprites);
    }
    for (let index = 0; index < TILES_PER_CHUNK; index++) {
      const code = chunk.object[index] ?? EMPTY_TILE;
      if (code !== EMPTY_TILE) {
        const x = chunk.cx * CHUNK_SIZE + (index % CHUNK_SIZE);
        const y = chunk.cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE);
        this.place(sprites, index, x, y, code);
      }
    }
  }

  hide(layer: number, cx: number, cy: number): void {
    const key = chunkKey(layer, cx, cy);
    const sprites = this.shown.get(key);
    if (sprites) {
      this.releaseAll(sprites);
      this.shown.delete(key);
    }
  }

  /** Shows the object now on tile (x, y) of a shown chunk, or none. */
  updateTile(chunk: Chunk, x: number, y: number): void {
    const sprites = this.shown.get(chunkKey(chunk.layer, chunk.cx, chunk.cy));
    if (!sprites || chunkCoord(x) !== chunk.cx || chunkCoord(y) !== chunk.cy) {
      return;
    }
    const index = tileIndex(localCoord(x), localCoord(y));
    this.release(sprites, index);
    const code = chunk.object[index] ?? EMPTY_TILE;
    if (code !== EMPTY_TILE) {
      this.place(sprites, index, x, y, code);
    }
  }

  destroy(): void {
    for (const sprites of this.shown.values()) {
      for (const sprite of sprites.values()) {
        sprite.destroy();
      }
    }
    for (const sprite of this.pool) {
      sprite.destroy();
    }
    this.shown.clear();
    this.pool.length = 0;
  }

  private place(
    sprites: Map<number, Phaser.GameObjects.Image>,
    index: number,
    x: number,
    y: number,
    code: number,
  ): void {
    const tile = tileOfCode(this.content, code);
    if (!tile) {
      return;
    }
    const { key, frame } = this.textures.frame(tile.sprite, objectVariant(x, y));
    const anchor = objectAnchor(x, y);
    const sprite =
      this.pool.pop()?.setTexture(key, frame).setVisible(true) ??
      this.scene.add.image(0, 0, key, frame).setOrigin(0.5, 1);
    sprite.setPosition(anchor.x, anchor.y).setDepth(sortDepth(anchor.y, 'object'));
    sprites.set(index, sprite);
  }

  private release(sprites: Map<number, Phaser.GameObjects.Image>, index: number): void {
    const sprite = sprites.get(index);
    if (sprite) {
      this.pool.push(sprite.setVisible(false));
      sprites.delete(index);
    }
  }

  private releaseAll(sprites: Map<number, Phaser.GameObjects.Image>): void {
    for (const sprite of sprites.values()) {
      this.pool.push(sprite.setVisible(false));
    }
    sprites.clear();
  }
}

function chunkKey(layer: number, cx: number, cy: number): string {
  return `${layer}:${cx}:${cy}`;
}
