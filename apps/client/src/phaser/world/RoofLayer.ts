import { CHUNK_SIZE, type Chunk, chunkCoord, localCoord, roomOf, tileIndex } from '@8box/shared';
import type * as Phaser from 'phaser';
import { DEPTH, objectAnchor } from '../depth';
import type { SpriteTextures } from './SpriteTextures';

/** Sprite of a roof tile. */
const ROOF_SPRITE = 'roof.default';

/** A roof tile shown: its sprite and the room it covers. */
interface RoofTile {
  sprite: Phaser.GameObjects.Image;
  room: number;
}

/**
 * `alpha` moved toward `target` (0 or 1) by the share of a full fade (`fadeMs`) that `deltaMs` is.
 */
export function fadeToward(alpha: number, target: number, deltaMs: number, fadeMs: number): number {
  const step = fadeMs > 0 ? deltaMs / fadeMs : 1;
  return target > alpha ? Math.min(target, alpha + step) : Math.max(target, alpha - step);
}

/**
 * The roofs of the rooms of the loaded chunks: one sprite per tile that has a room (in its meta, found
 * by the server), drawn one tile higher (on top of the walls) and over every object and entity, so that
 * the inside of a room is hidden. The roof of the room where the local player stands fades out, the
 * others stay; a tile that leaves its room (a wall broken) loses its roof.
 */
export class RoofLayer {
  /** Chunk key → tile index → its roof. */
  private readonly shown = new Map<string, Map<number, RoofTile>>();
  /** Room → roof tiles shown. */
  private readonly rooms = new Map<number, Set<Phaser.GameObjects.Image>>();
  /** Room → alpha of its roof, while it is not fully shown. */
  private readonly faded = new Map<number, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: SpriteTextures,
    private readonly fadeMs: number,
  ) {}

  /** Places the roofs of a chunk (or places them again when the chunk was replaced). */
  show(chunk: Chunk): void {
    this.hide(chunk.layer, chunk.cx, chunk.cy);
    for (const index of chunk.meta.keys()) {
      this.updateTile(
        chunk,
        chunk.cx * CHUNK_SIZE + (index % CHUNK_SIZE),
        chunk.cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE),
      );
    }
  }

  hide(layer: number, cx: number, cy: number): void {
    const key = chunkKey(layer, cx, cy);
    const roofs = this.shown.get(key);
    if (roofs) {
      for (const index of [...roofs.keys()]) {
        this.remove(roofs, index);
      }
      this.shown.delete(key);
    }
  }

  /** Shows the roof of tile (x, y) of a chunk as its meta says now: none outside rooms. */
  updateTile(chunk: Chunk, x: number, y: number): void {
    if (chunkCoord(x) !== chunk.cx || chunkCoord(y) !== chunk.cy) {
      return;
    }
    const key = chunkKey(chunk.layer, chunk.cx, chunk.cy);
    let roofs = this.shown.get(key);
    if (!roofs) {
      roofs = new Map();
      this.shown.set(key, roofs);
    }
    const index = tileIndex(localCoord(x), localCoord(y));
    const room = roomOf(chunk.meta.get(index));
    if (roofs.get(index)?.room === room) {
      return;
    }
    this.remove(roofs, index);
    if (room === undefined) {
      return;
    }
    const { key: texture, frame } = this.textures.frame(ROOF_SPRITE);
    const anchor = objectAnchor(x, y - 1);
    const sprite = this.scene.add
      .image(anchor.x, anchor.y, texture, frame)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.roof)
      .setAlpha(this.alphaOf(room));
    roofs.set(index, { sprite, room });
    let sprites = this.rooms.get(room);
    if (!sprites) {
      sprites = new Set();
      this.rooms.set(room, sprites);
    }
    sprites.add(sprite);
  }

  /** Fades the roofs: out for room `inside` (where the local player stands), back in for the others. */
  update(inside: number | undefined, deltaMs: number): void {
    if (inside !== undefined && !this.faded.has(inside)) {
      this.faded.set(inside, 1);
    }
    for (const [room, alpha] of this.faded) {
      const next = fadeToward(alpha, room === inside ? 0 : 1, deltaMs, this.fadeMs);
      if (next === 1) {
        this.faded.delete(room);
      } else {
        this.faded.set(room, next);
      }
      for (const sprite of this.rooms.get(room) ?? []) {
        sprite.setAlpha(next);
      }
    }
  }

  destroy(): void {
    for (const sprites of this.rooms.values()) {
      for (const sprite of sprites) {
        sprite.destroy();
      }
    }
    this.rooms.clear();
    this.shown.clear();
    this.faded.clear();
  }

  private alphaOf(room: number): number {
    return this.faded.get(room) ?? 1;
  }

  private remove(roofs: Map<number, RoofTile>, index: number): void {
    const roof = roofs.get(index);
    if (!roof) {
      return;
    }
    roofs.delete(index);
    const sprites = this.rooms.get(roof.room);
    sprites?.delete(roof.sprite);
    if (sprites?.size === 0) {
      this.rooms.delete(roof.room);
    }
    roof.sprite.destroy();
  }
}

function chunkKey(layer: number, cx: number, cy: number): string {
  return `${layer}:${cx}:${cy}`;
}
