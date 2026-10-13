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
  /** The state of tile (x, y) of a loaded chunk changed (a door opened): redraw its object. */
  'tile.meta': { chunk: Chunk; x: number; y: number };
  /**
   * Game → Phaser: HP left of tile (x, y), being broken (`hp` = `maxHp`: it got them all back). Forget
   * it when the tile changes or its chunk is unloaded.
   */
  'tile.damaged': { layer: number; x: number; y: number; hp: number; maxHp: number };
  /** Keyboard or joystick → game: movement direction held (an index of `DIRECTIONS`, 0 = still). */
  'input.direction': { dir: number };
  /** Touch buttons → game: a button was pressed (handled by the steps that bring each action). */
  'input.button': { button: TouchButton };
  /**
   * Phaser → game: open the action menu of tile (x, y) (right click, or long press on a touch screen);
   * `screen` is where, in CSS pixels.
   */
  'world.menu': { x: number; y: number; screen: { x: number; y: number } };
  /** Phaser → game: the tile under the mouse, or null when the mouse is off the world (aim). */
  'pointer.tile': { tile: { x: number; y: number } | null };
  /** Keyboard → game: the main action on the aimed tile (E). */
  'action.main': Record<string, never>;
  /** Keyboard or mouse → game: use the item in hand (Space, left click). */
  'action.use': Record<string, never>;
  /** Phaser → game: size of the game view, in CSS pixels, and camera zoom. */
  'view.changed': { w: number; h: number; zoom: number };
  /** Phaser → game (dev mode): center of the free camera in tiles, or null when it follows the player. */
  'debugCamera.moved': { at: { x: number; y: number } | null };
  /** Game → Phaser: a player nearby said something: a bubble above the head of `entity`. */
  'chat.said': { entity: number; text: string };
  /** Keyboard → game: put the item of hotbar slot `slot` (0 to 9) in hand. */
  'hotbar.select': { slot: number };
  /** Mouse wheel → game: next (`delta` > 0) or previous hotbar slot. */
  'hotbar.scroll': { delta: number };
  /** Keyboard → game: drop the stack in hand, or `one` of its items. */
  'inventory.dropHeld': { one: boolean };
  /** Keyboard → UI: open or close the inventory window. */
  'inventory.toggle': Record<string, never>;
  /** Keyboard → UI: open or close the crafting window. */
  'crafting.toggle': Record<string, never>;
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
export type TouchButton = 'use' | 'action' | 'inventory' | 'craft';

export type ClientEventBus = TypedEmitter<ClientEvents>;

/** The bus shared by the whole client. */
export const eventBus: ClientEventBus = new TypedEmitter<ClientEvents>();
