import { DEBUG } from '@8box/shared';
import type * as Phaser from 'phaser';
import { eventBus } from '../game/events';
import type { CameraController } from './CameraController';

/** Key that turns the free camera on and off (`KeyboardEvent.code`). */
const TOGGLE_CODE = 'F2';

/**
 * Dev mode only: a free camera, turned on and off with F2, moved with the arrow keys (Shift: slowly)
 * to look around the world while the player stays put. The server streams the chunks around it; when
 * it is turned off, the camera follows the player again.
 */
export class DebugCamera {
  private readonly keys: Record<
    'up' | 'down' | 'left' | 'right' | 'slow',
    Phaser.Input.Keyboard.Key
  >;
  private active = false;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private moved = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly camera: CameraController,
    /** Called when the free camera is turned on (true) or off (false). */
    private readonly onToggle: (active: boolean) => void,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input unavailable');
    }
    // No capture: the keys keep working in the HTML fields (login name…).
    this.keys = keyboard.addKeys(
      { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', slow: 'SHIFT' },
      false,
    ) as typeof this.keys;
    window.addEventListener('keydown', this.onKeyDown);
  }

  get isActive(): boolean {
    return this.active;
  }

  update(deltaMs: number): void {
    if (!this.active || document.activeElement instanceof HTMLInputElement) {
      return;
    }
    const speed = this.keys.slow.isDown
      ? DEBUG.cameraSlowSpeedTilesPerSecond
      : DEBUG.cameraSpeedTilesPerSecond;
    const step = (speed * deltaMs) / 1000;
    const dx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const dy = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const center = this.camera.center();
      this.camera.centerOn({ x: center.x + dx * step, y: center.y + dy * step });
      this.moved = true;
    }
    const now = this.scene.time.now;
    if (this.moved && now - this.lastSentAt >= DEBUG.cameraSendIntervalMs) {
      this.moved = false;
      this.lastSentAt = now;
      eventBus.emit('debugCamera.moved', { at: this.camera.center() });
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== TOGGLE_CODE || event.repeat) {
      return;
    }
    event.preventDefault();
    this.active = !this.active;
    if (this.active) {
      this.camera.stopFollow();
    }
    this.onToggle(this.active);
    eventBus.emit('debugCamera.moved', { at: this.active ? this.camera.center() : null });
  };
}
