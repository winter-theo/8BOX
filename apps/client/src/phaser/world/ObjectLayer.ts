import {
  CHUNK_SIZE,
  type Chunk,
  type Content,
  chunkCoord,
  EMPTY_TILE,
  localCoord,
  type TileDef,
  type TileMeta,
  type TileSlot,
  tileIndex,
  tileOfCode,
} from '@8box/shared';
import type * as Phaser from 'phaser';
import { objectVariant } from '../../assets/objectArt';
import { objectSpriteId } from '../../assets/wallArt';
import { objectAnchor, sortDepth } from '../depth';
import type { SpriteTextures } from './SpriteTextures';

const TILES_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE;
/** The 4 sides of a tile: its neighbors whose wall may join it. */
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** What the layer reads of the loaded chunks, across chunk edges (the `ChunkCache`). */
export interface ObjectTiles {
  getTile(layer: number, x: number, y: number, slot: TileSlot): TileDef | undefined;
  getMeta(layer: number, x: number, y: number): TileMeta | undefined;
}

/**
 * The objects of the loaded chunks (trees, bushes, walls…): one sprite per tile, anchored at the bottom of
 * its tile and sorted by Y with the entities. A wall's sprite depends on its neighbors (`objectSpriteId`),
 * so the walls around a tile that changes, or along the edges of a chunk that arrives, are drawn again.
 * Sprites of a chunk that leaves go back to a pool and are reused for the next chunks, so streaming
 * creates few game objects.
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
    private readonly tiles: ObjectTiles,
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
    const left = chunk.cx * CHUNK_SIZE;
    const top = chunk.cy * CHUNK_SIZE;
    for (let index = 0; index < TILES_PER_CHUNK; index++) {
      const code = chunk.object[index] ?? EMPTY_TILE;
      if (code !== EMPTY_TILE) {
        const x = left + (index % CHUNK_SIZE);
        const y = top + Math.floor(index / CHUNK_SIZE);
        this.place(sprites, chunk, index, x, y, code);
      }
    }
    // The walls along the edges of the chunks around may now join the ones of this chunk.
    for (let i = 0; i < CHUNK_SIZE; i++) {
      this.redrawWall(chunk.layer, left - 1, top + i);
      this.redrawWall(chunk.layer, left + CHUNK_SIZE, top + i);
      this.redrawWall(chunk.layer, left + i, top - 1);
      this.redrawWall(chunk.layer, left + i, top + CHUNK_SIZE);
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

  /** Shows the object now on tile (x, y) of a shown chunk, or none, and the walls around it again. */
  updateTile(chunk: Chunk, x: number, y: number): void {
    const sprites = this.shown.get(chunkKey(chunk.layer, chunk.cx, chunk.cy));
    if (!sprites || chunkCoord(x) !== chunk.cx || chunkCoord(y) !== chunk.cy) {
      return;
    }
    const index = tileIndex(localCoord(x), localCoord(y));
    this.release(sprites, index);
    const code = chunk.object[index] ?? EMPTY_TILE;
    if (code !== EMPTY_TILE) {
      this.place(sprites, chunk, index, x, y, code);
    }
    for (const [dx, dy] of NEIGHBORS) {
      this.redrawWall(chunk.layer, x + dx, y + dy);
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

  /** Draws the wall on tile (x, y) again, if it is shown (its neighbors changed). */
  private redrawWall(layer: number, x: number, y: number): void {
    const sprite = this.shown
      .get(chunkKey(layer, chunkCoord(x), chunkCoord(y)))
      ?.get(tileIndex(localCoord(x), localCoord(y)));
    const tile = sprite && this.tiles.getTile(layer, x, y, 'object');
    if (sprite && tile?.wall) {
      const { key, frame } = this.textures.frame(this.spriteOf(layer, x, y, tile));
      sprite.setTexture(key, frame);
    }
  }

  private place(
    sprites: Map<number, Phaser.GameObjects.Image>,
    chunk: Chunk,
    index: number,
    x: number,
    y: number,
    code: number,
  ): void {
    const tile = tileOfCode(this.content, code);
    if (!tile) {
      return;
    }
    const { key, frame } = this.textures.frame(
      this.spriteOf(chunk.layer, x, y, tile, chunk.meta.get(index)),
      objectVariant(x, y),
    );
    const anchor = objectAnchor(x, y);
    const sprite =
      this.pool.pop()?.setTexture(key, frame).setVisible(true) ??
      this.scene.add.image(0, 0, key, frame).setOrigin(0.5, 1);
    sprite.setPosition(anchor.x, anchor.y).setDepth(sortDepth(anchor.y, 'object'));
    sprites.set(index, sprite);
  }

  /** Sprite of the object `tile` on (x, y), or of the tile itself when the art has no such sprite. */
  private spriteOf(
    layer: number,
    x: number,
    y: number,
    tile: TileDef,
    meta = this.tiles.getMeta(layer, x, y),
  ): string {
    const id = objectSpriteId(tile, x, y, meta, (nx, ny) =>
      this.tiles.getTile(layer, nx, ny, 'object'),
    );
    return this.textures.has(id) ? id : tile.sprite;
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
