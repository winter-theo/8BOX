import { directionOf } from '@8box/shared';

/** Physical keys (`KeyboardEvent.code`) of each way: WASD (ZQSD on AZERTY) and the arrows. */
const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;

const MOVEMENT_CODES: ReadonlySet<string> = new Set(Object.values(KEYS).flat());

/** Direction index (`DIRECTIONS`) of the held keys; opposite keys cancel out. */
export function directionFromKeys(held: ReadonlySet<string>): number {
  const pressed = (codes: readonly string[]) => (codes.some((code) => held.has(code)) ? 1 : 0);
  return directionOf(
    pressed(KEYS.right) - pressed(KEYS.left),
    pressed(KEYS.down) - pressed(KEYS.up),
  );
}

/**
 * Movement keys read from the DOM by physical position (`event.code`), so that WASD is ZQSD on an
 * AZERTY keyboard. Calls `onChange` with the new direction whenever it changes.
 */
export class MovementKeys {
  private readonly held = new Set<string>();
  private direction = 0;
  private enabled = true;

  constructor(private readonly onChange: (dir: number) => void) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  /** Disabled keys move nothing (free debug camera…). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.update();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!MOVEMENT_CODES.has(event.code) || isTyping(event)) {
      return;
    }
    event.preventDefault(); // The arrows would scroll the page.
    this.held.add(event.code);
    this.update();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (this.held.delete(event.code)) {
      this.update();
    }
  };

  /** The window lost focus: its key releases will not come. */
  private readonly releaseAll = () => {
    this.held.clear();
    this.update();
  };

  private update(): void {
    const direction = this.enabled ? directionFromKeys(this.held) : 0;
    if (direction !== this.direction) {
      this.direction = direction;
      this.onChange(direction);
    }
  }
}

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
}
