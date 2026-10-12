import { DEBUG, VIEW, WORLD } from '@8box/shared';
import * as Phaser from 'phaser';
import { eventBus } from '../game/events';

const TILE_PX = WORLD.tileSizePx;

/**
 * Dev mode only: a free camera moved with the arrow keys and zoomed with + / - or the mouse wheel,
 * to look around before the player can walk. The server streams the chunks around it.
 */
export class DebugCamera {
  private readonly keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private moved = false;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Called after the zoom changed. */
    private readonly onZoom: () => void,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input unavailable');
    }
    // No capture: the keys keep working in the HTML fields (login name…).
    this.keys = keyboard.addKeys(
      { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' },
      false,
    ) as typeof this.keys;
    // Zoom follows the printed symbol, wherever it sits on the keyboard (+ is Shift+= in QWERTY).
    keyboard.on('keydown', (event: KeyboardEvent) => {
      if (event.key === '+' || event.key === '=') {
        this.zoomBy(1);
      } else if (event.key === '-' || event.key === '_') {
        this.zoomBy(-1);
      }
    });
    scene.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_pointer: unknown, _objects: unknown, _dx: number, dy: number) =>
        this.zoomBy(dy > 0 ? -1 : 1),
    );
  }

  update(deltaMs: number): void {
    if (document.activeElement instanceof HTMLInputElement) {
      return; // Typing in a field, not steering the camera.
    }
    const camera = this.scene.cameras.main;
    const step = (DEBUG.cameraSpeedTilesPerSecond * TILE_PX * deltaMs) / 1000;
    const dx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const dy = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      camera.scrollX += dx * step;
      camera.scrollY += dy * step;
      this.moved = true;
    }
    const now = this.scene.time.now;
    if (this.moved && now - this.lastSentAt >= DEBUG.cameraSendIntervalMs) {
      this.moved = false;
      this.lastSentAt = now;
      eventBus.emit('debugCamera.moved', {
        x: camera.midPoint.x / TILE_PX,
        y: camera.midPoint.y / TILE_PX,
      });
    }
  }

  private zoomBy(step: number): void {
    const camera = this.scene.cameras.main;
    const zoom = Phaser.Math.Clamp(Math.round(camera.zoom) + step, VIEW.minZoom, VIEW.maxZoom);
    if (zoom !== camera.zoom) {
      camera.setZoom(zoom);
      this.onZoom();
    }
  }
}
