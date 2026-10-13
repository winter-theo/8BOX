import { VIEW, WORLD } from '@8box/shared';
import * as Phaser from 'phaser';
import { isTouchMode } from '../device';
import { eventBus } from '../game/events';

const TILE_PX = WORLD.tileSizePx;

/**
 * Touch mode: a finger held still on the world opens the action menu of the tile under it. Moving the
 * finger or adding a second one (pinch) cancels it.
 */
export class LongPress {
  private press:
    | { pointerId: number; x: number; y: number; timer: Phaser.Time.TimerEvent }
    | undefined;

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.cancel);
  }

  destroy(): void {
    this.cancel();
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.cancel);
  }

  private readonly onDown = (pointer: Phaser.Input.Pointer) => {
    if (this.press) {
      this.cancel(); // A second finger: a pinch, not a long press.
      return;
    }
    if (!isTouchMode()) {
      return;
    }
    const { x, y } = pointer;
    const timer = this.scene.time.delayedCall(VIEW.longPressMs, () => this.fire());
    this.press = { pointerId: pointer.id, x, y, timer };
  };

  private readonly onMove = (pointer: Phaser.Input.Pointer) => {
    const press = this.press;
    if (press && pointer.id === press.pointerId) {
      const moved = Phaser.Math.Distance.Between(press.x, press.y, pointer.x, pointer.y);
      if (moved > VIEW.longPressMoveTolerancePx) {
        this.cancel();
      }
    }
  };

  private readonly cancel = () => {
    this.press?.timer.remove();
    this.press = undefined;
  };

  private fire(): void {
    const press = this.press;
    this.press = undefined;
    if (!press) {
      return;
    }
    const world = this.scene.cameras.main.getWorldPoint(press.x, press.y);
    eventBus.emit('world.menu', {
      x: Math.floor(world.x / TILE_PX),
      y: Math.floor(world.y / TILE_PX),
      screen: { x: press.x, y: press.y },
    });
  }
}
