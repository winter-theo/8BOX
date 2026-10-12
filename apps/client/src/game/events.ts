import { type Chunk, TypedEmitter, type WorldPosition } from '@8box/shared';

/**
 * Events between the game layer, Phaser and React: they never import each other's components, they
 * talk through this bus (and the Zustand store for the UI).
 */
export type ClientEvents = {
  /** A chunk arrived from the server (new or replaced). */
  'chunk.loaded': { chunk: Chunk };
  /** A chunk is no longer followed: forget it. */
  'chunk.unloaded': { layer: number; cx: number; cy: number };
  /** Tiles of a loaded chunk changed: redraw it. */
  'chunk.changed': { chunk: Chunk };
  /** The local player joined the world. */
  'player.spawned': { position: WorldPosition };
  /** Phaser → game: size of the game view, in CSS pixels, and camera zoom. */
  'view.changed': { w: number; h: number; zoom: number };
  /** Phaser → game (dev mode): center of the free debug camera, in tiles. */
  'debugCamera.moved': { x: number; y: number };
};

export type ClientEventBus = TypedEmitter<ClientEvents>;

/** The bus shared by the whole client. */
export const eventBus: ClientEventBus = new TypedEmitter<ClientEvents>();
