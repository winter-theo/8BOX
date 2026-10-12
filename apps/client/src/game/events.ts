import { type Chunk, type TileSlot, TypedEmitter } from '@8box/shared';

/**
 * Events between the game layer, Phaser and React: they never import each other's components, they
 * talk through this bus (and the Zustand store for the UI).
 */
export type ClientEvents = {
  /** A chunk arrived from the server (new or replaced). */
  'chunk.loaded': { chunk: Chunk };
  /** A chunk is no longer followed: forget it. */
  'chunk.unloaded': { layer: number; cx: number; cy: number };
  /** A slot of tile (x, y) of a loaded chunk changed: redraw that tile. */
  'tile.changed': { chunk: Chunk; x: number; y: number; slot: TileSlot };
  /** Keyboard or joystick → game: movement direction held (an index of `DIRECTIONS`, 0 = still). */
  'input.direction': { dir: number };
  /** Touch buttons → game: a button was pressed (handled by the steps that bring each action). */
  'input.button': { button: TouchButton };
  /** Phaser → UI: a long press on the world, on tile (x, y); `screen` is where, in CSS pixels. */
  'world.longPress': { x: number; y: number; screen: { x: number; y: number } };
  /** Phaser → game: size of the game view, in CSS pixels, and camera zoom. */
  'view.changed': { w: number; h: number; zoom: number };
  /** Phaser → game (dev mode): center of the free camera in tiles, or null when it follows the player. */
  'debugCamera.moved': { at: { x: number; y: number } | null };
  /** Phaser → game (dev mode): frames per second, camera zoom and object sprites shown. */
  'debug.stats': DebugStats;
};

/** Rendering figures shown in the dev info. */
export interface DebugStats {
  fps: number;
  zoom: number;
  objects: number;
}

/** Buttons of the touch controls. */
export type TouchButton = 'use' | 'action' | 'inventory';

export type ClientEventBus = TypedEmitter<ClientEvents>;

/** The bus shared by the whole client. */
export const eventBus: ClientEventBus = new TypedEmitter<ClientEvents>();
