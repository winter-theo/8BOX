import { WORLD } from '@8box/shared';
import * as Phaser from 'phaser';
import { defaultZoom, pinchStep, stepZoom, type ZoomRange, zoomRange } from './zoom';

const TILE_PX = WORLD.tileSizePx;
const WORLD_PX = WORLD.layerSizeTiles * TILE_PX;

/**
 * The main camera: whole zoom steps (+ / − keys, pinch on a touch screen) in a range that depends on the
 * size of the view, kept inside the map, following a target (the test character in dev, the player from
 * step 07).
 */
export class CameraController {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private range: ZoomRange;
  /** Distance between the two fingers when the pinch started or last zoomed, in screen pixels. */
  private pinchStart: number | undefined;
  /** Until the player zooms, a resized view gets the default zoom again (about 40 tiles across). */
  private zoomedByPlayer = false;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Called when the zoom or the size of the view changed. */
    private readonly onViewChange: () => void,
  ) {
    this.camera = scene.cameras.main;
    const { width, height } = scene.scale;
    this.range = zoomRange(width, height);
    this.camera.setBounds(0, 0, WORLD_PX, WORLD_PX);
    this.camera.setZoom(defaultZoom(width, height));
    this.camera.centerOn(WORLD_PX / 2, WORLD_PX / 2);

    // DOM events rather than Phaser's keyboard plugin: it replays the keydowns of a frame on each new
    // key event, so two quick presses would zoom several steps.
    window.addEventListener('keydown', this.onKeyDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
  }

  get zoom(): number {
    return this.camera.zoom;
  }

  /** Keeps `target` (a sprite, or any point in world pixels) at the center of the view. */
  follow(target: { x: number; y: number }): void {
    this.camera.startFollow(target, true);
  }

  stopFollow(): void {
    this.camera.stopFollow();
  }

  /** Center of the view, in tiles. */
  center(): { x: number; y: number } {
    return { x: this.camera.midPoint.x / TILE_PX, y: this.camera.midPoint.y / TILE_PX };
  }

  /** Centers the view on a position in tiles, when there is no target to follow. */
  centerOn(position: { x: number; y: number }): void {
    this.camera.centerOn(position.x * TILE_PX, position.y * TILE_PX);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return; // One step per press; typing in a field is not zooming.
    }
    // Zoom follows the printed symbol, wherever it sits on the keyboard (+ is Shift+= in QWERTY).
    if (event.key === '+' || event.key === '=') {
      this.zoomBy(1);
    } else if (event.key === '-' || event.key === '_') {
      this.zoomBy(-1);
    }
  };

  private readonly onPointerMove = () => {
    const { pointer1, pointer2 } = this.scene.input;
    if (!pointer1?.isDown || !pointer2?.isDown) {
      this.pinchStart = undefined;
      return;
    }
    const distance = Phaser.Math.Distance.Between(pointer1.x, pointer1.y, pointer2.x, pointer2.y);
    if (this.pinchStart === undefined) {
      this.pinchStart = distance;
      return;
    }
    const step = pinchStep(this.pinchStart, distance);
    if (step !== 0) {
      this.zoomBy(step);
      this.pinchStart = distance;
    }
  };

  private readonly onResize = () => {
    const { width, height } = this.scene.scale;
    this.range = zoomRange(width, height);
    this.camera.setZoom(
      this.zoomedByPlayer ? stepZoom(this.camera.zoom, 0, this.range) : defaultZoom(width, height),
    );
    this.onViewChange();
  };

  private zoomBy(step: number): void {
    this.zoomedByPlayer = true;
    const zoom = stepZoom(this.camera.zoom, step, this.range);
    if (zoom !== this.camera.zoom) {
      this.camera.setZoom(zoom);
      this.onViewChange();
    }
  }
}
