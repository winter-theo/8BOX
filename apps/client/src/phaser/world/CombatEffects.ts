import { COMBAT, type Content, type Facing, VIEW } from '@8box/shared';
import * as Phaser from 'phaser';
import { PALETTE } from '../../assets/palette';
import type { SpriteTextures } from './SpriteTextures';
import { blinkVisible, swingAngle } from './swing';

/** Distance from the middle of the character to the swung weapon, in world pixels. */
const SWING_RADIUS_PX = 5;
/** Size of the swung weapon, relative to its icon (no unit). */
const SWING_SCALE = 0.75;
/** Item icons point up and right: the turn that makes them point along the angle 0 (right). */
const ICON_TURN = Math.PI / 4;
/** Opacity of a blinking character while it is hidden (no unit). */
const BLINK_HIDDEN_ALPHA = 0.25;
/** Height a damage number rises while it fades, in CSS pixels. */
const NUMBER_RISE_CSS_PX = 16;

interface Swing {
  startMs: number;
  facing: Facing;
  /** The weapon icon, or a small fist bare-handed. */
  shape: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
}

interface DamageNumber {
  element: HTMLDivElement;
  startMs: number;
  /** Top of the hit character, in world pixels. */
  at: { x: number; y: number };
}

/**
 * The fights in the world: the weapon (or the fist) sweeping in front of a character who attacks, over
 * it; a hit character blinking while it cannot be hurt; the damage rising above it (HTML over the
 * canvas, sharp at every zoom, like the names).
 */
export class CombatEffects {
  private readonly swings = new Map<number, Swing>();
  private readonly blinks = new Map<number, number>();
  private readonly numbers = new Set<DamageNumber>();
  private readonly layer: HTMLDivElement;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: SpriteTextures,
    private readonly content: Content,
    private readonly image: (entity: number) => Phaser.GameObjects.Image | undefined,
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'damage-numbers';
    scene.game.canvas.parentElement?.append(this.layer);
    this.camera = scene.cameras.main;
    this.camera.on(Phaser.Cameras.Scene2D.Events.POST_RENDER, this.place, this);
  }

  /** A character swings what it holds (`item`, none bare-handed) toward `facing`. */
  swing(entity: number, facing: Facing, item: string | undefined, nowMs: number): void {
    this.swings.get(entity)?.shape.destroy();
    const sprite = item === undefined ? undefined : this.content.items.get(item)?.sprite;
    let shape: Swing['shape'];
    if (sprite === undefined) {
      shape = this.scene.add
        .graphics()
        .fillStyle(Number.parseInt(PALETTE.bone.slice(1), 16), 1)
        .fillRect(-1, -1, 2, 2);
    } else {
      const { key, frame } = this.textures.frame(sprite);
      shape = this.scene.add.image(0, 0, key, frame).setScale(SWING_SCALE);
    }
    this.swings.set(entity, { startMs: nowMs, facing, shape });
  }

  /** A character lost `amount` HP: it blinks, and the amount rises above it. */
  damaged(entity: number, amount: number, nowMs: number): void {
    this.blinks.set(entity, nowMs);
    const image = this.image(entity);
    if (!image || amount <= 0) {
      return;
    }
    const element = document.createElement('div');
    element.className = 'damage-number';
    element.textContent = `-${amount}`;
    element.hidden = true; // Until placed.
    this.layer.append(element);
    this.numbers.add({ element, startMs: nowMs, at: { x: image.x, y: image.y - image.height } });
  }

  /** Called every frame, after the characters were moved. */
  update(nowMs: number): void {
    for (const [entity, swing] of this.swings) {
      const image = this.image(entity);
      const progress = (nowMs - swing.startMs) / VIEW.swingMs;
      if (!image || progress >= 1) {
        swing.shape.destroy();
        this.swings.delete(entity);
        continue;
      }
      const angle = swingAngle(swing.facing, progress);
      const centerY = image.y - image.height / 2;
      swing.shape
        .setPosition(
          Math.round(image.x + Math.cos(angle) * SWING_RADIUS_PX),
          Math.round(centerY + Math.sin(angle) * SWING_RADIUS_PX),
        )
        .setDepth(image.depth + 0.5);
      if (swing.shape instanceof Phaser.GameObjects.Image) {
        swing.shape.setRotation(angle + ICON_TURN);
      }
    }
    for (const [entity, startMs] of this.blinks) {
      const image = this.image(entity);
      const elapsed = nowMs - startMs;
      if (!image || elapsed >= COMBAT.hitInvulnerabilityMs) {
        image?.setAlpha(1);
        this.blinks.delete(entity);
        continue;
      }
      image.setAlpha(blinkVisible(elapsed) ? 1 : BLINK_HIDDEN_ALPHA);
    }
    for (const number of this.numbers) {
      if (nowMs - number.startMs >= VIEW.damageNumberMs) {
        number.element.remove();
        this.numbers.delete(number);
      }
    }
  }

  destroy(): void {
    this.camera.off(Phaser.Cameras.Scene2D.Events.POST_RENDER, this.place, this);
    for (const swing of this.swings.values()) {
      swing.shape.destroy();
    }
    this.swings.clear();
    this.blinks.clear();
    this.numbers.clear();
    this.layer.remove();
  }

  /** After the camera rendered: each number above its character, rising and fading. */
  private place(camera: Phaser.Cameras.Scene2D.Camera): void {
    const view = camera.worldView;
    const now = performance.now();
    for (const { element, startMs, at } of this.numbers) {
      const progress = Math.min(1, (now - startMs) / VIEW.damageNumberMs);
      const x = (at.x - view.x) * camera.zoom + camera.x;
      const y = (at.y - view.y) * camera.zoom + camera.y - progress * NUMBER_RISE_CSS_PX;
      element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      element.style.opacity = String(1 - progress);
      element.hidden = false;
    }
  }
}
