import { CHAT } from '@8box/shared';
import * as Phaser from 'phaser';
import { bubbleText } from './bubbleText';

/** Room kept above a head for the name label, in CSS pixels. */
const NAME_LABEL_CSS_PX = 18;

/** Where a sprite is drawn: anchored at the middle of its feet, in world pixels. */
interface SpriteBox {
  x: number;
  y: number;
  height: number;
}

interface Bubble {
  element: HTMLDivElement;
  /** `performance.now()` time when it goes away, in ms. */
  expiresAt: number;
}

/**
 * Speech bubbles above the heads of the players who talk nearby, for `CHAT.bubbleDurationMs`. They are
 * HTML over the game canvas (every character, sharp at every zoom), moved after each render to where
 * the camera shows the speaker.
 */
export class ChatBubbles {
  private readonly layer: HTMLDivElement;
  private readonly bubbles = new Map<number, Bubble>();
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(
    scene: Phaser.Scene,
    /** The sprite of an entity drawn now, if any. */
    private readonly spriteOf: (entity: number) => SpriteBox | undefined,
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'chat-bubbles';
    scene.game.canvas.parentElement?.append(this.layer);
    this.camera = scene.cameras.main;
    this.camera.on(Phaser.Cameras.Scene2D.Events.POST_RENDER, this.place, this);
  }

  /** Shows what `entity` said, replacing its previous bubble. */
  say(entity: number, text: string): void {
    let bubble = this.bubbles.get(entity);
    if (!bubble) {
      const element = document.createElement('div');
      element.className = 'chat-bubble';
      element.hidden = true; // Until placed.
      this.layer.append(element);
      bubble = { element, expiresAt: 0 };
      this.bubbles.set(entity, bubble);
    }
    bubble.element.textContent = bubbleText(text);
    bubble.expiresAt = performance.now() + CHAT.bubbleDurationMs;
  }

  destroy(): void {
    this.camera.off(Phaser.Cameras.Scene2D.Events.POST_RENDER, this.place, this);
    this.layer.remove();
    this.bubbles.clear();
  }

  /** After the camera rendered: each bubble above its speaker's name, or hidden when not in view. */
  private place(camera: Phaser.Cameras.Scene2D.Camera): void {
    const now = performance.now();
    const view = camera.worldView;
    for (const [entity, bubble] of this.bubbles) {
      if (now >= bubble.expiresAt) {
        bubble.element.remove();
        this.bubbles.delete(entity);
        continue;
      }
      const sprite = this.spriteOf(entity);
      bubble.element.hidden = !sprite;
      if (sprite) {
        const x = (sprite.x - view.x) * camera.zoom + camera.x;
        const y = (sprite.y - sprite.height - view.y) * camera.zoom + camera.y - NAME_LABEL_CSS_PX;
        bubble.element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      }
    }
  }
}
