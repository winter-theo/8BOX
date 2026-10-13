import * as Phaser from 'phaser';
import type { ClientEventBus } from '../game/events';

/** Hotbar keys by physical position (`KeyboardEvent.code`): 1 to 9, then 0 for the tenth slot. */
const HOTBAR_CODES = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
] as const;

/** Hotbar slot (0 to 9) of a key, or undefined. Numpad digits count too. */
export function hotbarSlotOfCode(code: string): number | undefined {
  const digit = code.startsWith('Numpad') ? code.replace('Numpad', 'Digit') : code;
  const slot = (HOTBAR_CODES as readonly string[]).indexOf(digit);
  return slot === -1 ? undefined : slot;
}

/** Inventory window (I), and drop the item in hand (Q, A on AZERTY; with Shift: one item). */
const TOGGLE_CODE = 'KeyI';
const DROP_CODE = 'KeyQ';
/** Shortest time between two hotbar steps of the wheel: a touchpad sends many small scrolls, in ms. */
const WHEEL_STEP_MS = 60;

/**
 * Keys and wheel of the inventory: pick a hotbar slot (1 to 0, wheel), open the inventory (I), drop
 * the item in hand (Q). Read from the DOM by physical position; ignored while typing.
 */
export class InventoryKeys {
  private lastWheel = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: ClientEventBus,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (
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
    const slot = hotbarSlotOfCode(event.code);
    if (slot !== undefined) {
      this.bus.emit('hotbar.select', { slot });
    } else if (event.code === TOGGLE_CODE) {
      this.bus.emit('inventory.toggle', {});
    } else if (event.code === DROP_CODE) {
      this.bus.emit('inventory.dropHeld', { one: event.shiftKey });
    }
  };

  private readonly onWheel = (
    _pointer: Phaser.Input.Pointer,
    _objects: unknown,
    _dx: number,
    dy: number,
  ) => {
    const now = performance.now();
    if (dy === 0 || now - this.lastWheel < WHEEL_STEP_MS) {
      return;
    }
    this.lastWheel = now;
    this.bus.emit('hotbar.scroll', { delta: dy });
  };
}
