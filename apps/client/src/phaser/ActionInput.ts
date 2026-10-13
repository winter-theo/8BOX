import { WORLD } from '@8box/shared';
import type * as Phaser from 'phaser';
import { isTouchMode } from '../device';
import type { ClientEventBus } from '../game/events';
import { actionOfCode } from './actionKeys';

const TILE_PX = WORLD.tileSizePx;

/** `Phaser.Input.Events.POINTER_DOWN` (only types are imported from Phaser here: testable without it). */
const POINTER_DOWN_EVENT = 'pointerdown';

/**
 * Keys and mouse of the actions: E (main action), Space and left click (use the item in hand), right
 * click (action menu of the tile), and the tile under the mouse for the aim. Touch screens use the
 * buttons and the long press instead (`LongPress`). Keys are ignored while typing.
 */
export class ActionInput {
  private pointerTile: { x: number; y: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: ClientEventBus,
  ) {
    scene.input.mouse?.disableContextMenu();
    window.addEventListener('keydown', this.onKeyDown);
    scene.input.on(POINTER_DOWN_EVENT, this.onPointerDown);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.scene.input.off(POINTER_DOWN_EVENT, this.onPointerDown);
  }

  /** Every frame: the tile under the mouse moves with the camera even when the mouse stands still. */
  update(): void {
    const pointer = this.scene.input.activePointer;
    const tile =
      isTouchMode() || !this.scene.input.isOver || pointer.wasTouch ? null : this.tileAt(pointer);
    if (tile?.x !== this.pointerTile?.x || tile?.y !== this.pointerTile?.y) {
      this.pointerTile = tile;
      this.bus.emit('pointer.tile', { tile });
    }
  }

  private tileAt(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: Math.floor(world.x / TILE_PX), y: Math.floor(world.y / TILE_PX) };
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const action = actionOfCode(event.code);
    if (
      !action ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }
    event.preventDefault(); // Space would scroll or press the focused button.
    this.bus.emit(action === 'main' ? 'action.main' : 'action.use', {});
  };

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (isTouchMode() || pointer.wasTouch) {
      return; // Touch: buttons and long press.
    }
    if (pointer.rightButtonDown()) {
      const tile = this.tileAt(pointer);
      this.bus.emit('world.menu', { ...tile, screen: { x: pointer.x, y: pointer.y } });
    } else if (pointer.leftButtonDown()) {
      this.bus.emit('action.use', {});
    }
  };
}
