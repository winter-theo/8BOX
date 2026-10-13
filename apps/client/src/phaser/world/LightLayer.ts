import {
  ambientLight,
  CHUNK_SIZE,
  type Chunk,
  type Content,
  chunkCoord,
  daylight,
  EMPTY_TILE,
  LIGHT,
  localCoord,
  tileIndex,
  tileOfCode,
  WORLD,
} from '@8box/shared';
import * as Phaser from 'phaser';
import { DEPTH } from '../depth';
import { darknessTint } from './darkness';

const TILE_PX = WORLD.tileSizePx;
const TILES_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE;
/** Generated texture of a soft halo: white, opaque at the centre, clear at the edge. */
const HALO_TEXTURE = 'light.halo';
/** Side of the halo texture, in pixels: scaled to the radius of each light. */
const HALO_SIZE_PX = 64;
/** Color stops of the halo gradient. */
const HALO_STOPS = 8;
/** Darkness drawn beyond the edges of the view, in world pixels: the camera moves after `update`. */
const MARGIN_PX = 4 * TILE_PX;

/** A light source shown: the middle of its tile, in world pixels, and its radius. */
interface Light {
  x: number;
  y: number;
  radiusPx: number;
}

/** The halo texture: alpha 1 − (d / r)², as the light of a source fades (`sourceLight`). */
function createHaloTexture(textures: Phaser.Textures.TextureManager): void {
  if (textures.exists(HALO_TEXTURE)) {
    return;
  }
  const texture = textures.createCanvas(HALO_TEXTURE, HALO_SIZE_PX, HALO_SIZE_PX);
  if (!texture) {
    return;
  }
  const half = HALO_SIZE_PX / 2;
  const gradient = texture.context.createRadialGradient(half, half, 0, half, half, half);
  for (let i = 0; i <= HALO_STOPS; i++) {
    const ratio = i / HALO_STOPS;
    gradient.addColorStop(ratio, `rgba(255, 255, 255, ${1 - ratio * ratio})`);
  }
  texture.context.fillStyle = gradient;
  texture.context.fillRect(0, 0, HALO_SIZE_PX, HALO_SIZE_PX);
  texture.refresh();
}

function chunkKey(layer: number, cx: number, cy: number): string {
  return `${layer}:${cx}:${cy}`;
}

/**
 * The darkness of the night over the world: a layer that covers the view, darker and bluer as the
 * daylight goes (orange at dawn and dusk), with soft halos cut out around the light sources of the
 * loaded chunks and a faint glow around the local player (to stay playable). Hidden by day.
 */
export class LightLayer {
  /** Chunk key → tile index → its light. */
  private readonly lights = new Map<string, Map<number, Light>>();
  private readonly overlay: Phaser.GameObjects.RenderTexture;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
  ) {
    createHaloTexture(scene.textures);
    this.overlay = scene.add
      .renderTexture(0, 0, TILE_PX, TILE_PX)
      .setOrigin(0, 0)
      .setDepth(DEPTH.darkness)
      .setVisible(false);
  }

  /** Finds the light sources of a chunk (again when the chunk was replaced). */
  show(chunk: Chunk): void {
    const lights = new Map<number, Light>();
    this.lights.set(chunkKey(chunk.layer, chunk.cx, chunk.cy), lights);
    for (let index = 0; index < TILES_PER_CHUNK; index++) {
      this.place(lights, chunk, index);
    }
  }

  hide(layer: number, cx: number, cy: number): void {
    this.lights.delete(chunkKey(layer, cx, cy));
  }

  /** The object of tile (x, y) of a shown chunk changed: a light placed or taken away. */
  updateTile(chunk: Chunk, x: number, y: number): void {
    const lights = this.lights.get(chunkKey(chunk.layer, chunk.cx, chunk.cy));
    if (!lights || chunkCoord(x) !== chunk.cx || chunkCoord(y) !== chunk.cy) {
      return;
    }
    const index = tileIndex(localCoord(x), localCoord(y));
    lights.delete(index);
    this.place(lights, chunk, index);
  }

  /**
   * Draws the darkness at world time `worldTimeMs` (undefined: not known yet, nothing drawn), with the
   * glow around the feet of the local player `player` (in tiles).
   */
  update(worldTimeMs: number | undefined, player: { x: number; y: number } | undefined): void {
    const darkness = worldTimeMs === undefined ? 0 : 1 - ambientLight(worldTimeMs);
    if (worldTimeMs === undefined || darkness <= 0) {
      this.overlay.setVisible(false);
      return;
    }
    const view = this.scene.cameras.main.worldView;
    const left = Math.floor(view.x) - MARGIN_PX;
    const top = Math.floor(view.y) - MARGIN_PX;
    const width = Math.ceil(view.width) + 2 * MARGIN_PX;
    const height = Math.ceil(view.height) + 2 * MARGIN_PX;
    if (this.overlay.width !== width || this.overlay.height !== height) {
      this.overlay.resize(width, height, false);
    }
    this.overlay.setPosition(left, top);
    this.overlay.clear();
    this.overlay.fill(darknessTint(daylight(worldTimeMs)), darkness);
    for (const lights of this.lights.values()) {
      for (const { x, y, radiusPx } of lights.values()) {
        if (
          x + radiusPx > left &&
          x - radiusPx < left + width &&
          y + radiusPx > top &&
          y - radiusPx < top + height
        ) {
          this.cutHalo(x - left, y - top, radiusPx, 1);
        }
      }
    }
    if (player) {
      // Around the middle of the character, half a tile above its feet.
      this.cutHalo(
        player.x * TILE_PX - left,
        (player.y - 0.5) * TILE_PX - top,
        LIGHT.playerGlowRadiusTiles * TILE_PX,
        LIGHT.playerGlowStrength,
      );
    }
    this.overlay.render();
    this.overlay.setVisible(true);
  }

  destroy(): void {
    this.lights.clear();
    this.overlay.destroy();
  }

  /** Lightens the darkness in a soft disc (overlay pixels), `strength` from 0 to 1. */
  private cutHalo(x: number, y: number, radiusPx: number, strength: number): void {
    this.overlay.stamp(HALO_TEXTURE, undefined, x, y, {
      scale: (2 * radiusPx) / HALO_SIZE_PX,
      alpha: strength,
      blendMode: Phaser.BlendModes.ERASE,
    });
  }

  private place(lights: Map<number, Light>, chunk: Chunk, index: number): void {
    const code = chunk.object[index] ?? EMPTY_TILE;
    if (code === EMPTY_TILE) {
      return;
    }
    const radiusTiles = tileOfCode(this.content, code)?.light?.radiusTiles;
    if (radiusTiles !== undefined) {
      lights.set(index, {
        x: (chunk.cx * CHUNK_SIZE + (index % CHUNK_SIZE) + 0.5) * TILE_PX,
        y: (chunk.cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE) + 0.5) * TILE_PX,
        radiusPx: radiusTiles * TILE_PX,
      });
    }
  }
}
