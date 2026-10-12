import { DEBUG, WORLD } from '@8box/shared';
import type * as Phaser from 'phaser';
import { eventBus } from '../game/events';
import type { CameraController } from './CameraController';
import type { EntityLayer } from './world/EntityLayer';

/** Id of the test character in the entity layer: server entity ids are positive. */
const TEST_ENTITY_ID = -1;
const TEST_ENTITY_SPRITE = 'char.default';
const MAP_TILES = WORLD.layerSizeTiles;

/**
 * Dev mode only: a test character walked with the arrow keys (Shift: slowly) and followed by the camera,
 * to look around before the player can walk and to check the depth sorting (behind or in front of a
 * tree). It is local: the server only streams the chunks around it.
 */
export class DebugCamera {
  private readonly keys: Record<
    'up' | 'down' | 'left' | 'right' | 'slow',
    Phaser.Input.Keyboard.Key
  >;
  /** Feet of the test character, in tiles. */
  private position = { x: MAP_TILES / 2, y: MAP_TILES / 2 };
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private moved = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly entities: EntityLayer,
    camera: CameraController,
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
    camera.follow(this.entities.set(TEST_ENTITY_ID, TEST_ENTITY_SPRITE, this.position));
  }

  /** Puts the test character (and the view) at a position in tiles. */
  moveTo(position: { x: number; y: number }): void {
    this.position = { x: position.x, y: position.y };
    this.entities.set(TEST_ENTITY_ID, TEST_ENTITY_SPRITE, this.position);
  }

  update(deltaMs: number): void {
    if (document.activeElement instanceof HTMLInputElement) {
      return; // Typing in a field, not walking.
    }
    const speed = this.keys.slow.isDown
      ? DEBUG.cameraSlowSpeedTilesPerSecond
      : DEBUG.cameraSpeedTilesPerSecond;
    const step = (speed * deltaMs) / 1000;
    const dx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const dy = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      this.moveTo({
        x: Math.min(MAP_TILES, Math.max(0, this.position.x + dx * step)),
        y: Math.min(MAP_TILES, Math.max(0, this.position.y + dy * step)),
      });
      this.moved = true;
    }
    const now = this.scene.time.now;
    if (this.moved && now - this.lastSentAt >= DEBUG.cameraSendIntervalMs) {
      this.moved = false;
      this.lastSentAt = now;
      eventBus.emit('debugCamera.moved', { at: { ...this.position } });
    }
  }
}
