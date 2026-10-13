import * as Phaser from 'phaser';

/** Gap between the top of a character and its name, in CSS pixels. */
const GAP_CSS_PX = 2;

interface Label {
  element: HTMLDivElement;
  /** Top of the character's sprite, in world pixels. */
  top: { x: number; y: number };
}

/**
 * Names above the heads of characters, in the font of the interface (like its buttons). They are HTML
 * over the game canvas (sharp at every zoom, never hidden by a tree), moved after each render to where
 * the camera shows the character.
 */
export class NameLabels {
  private readonly layer: HTMLDivElement;
  private readonly labels = new Map<number, Label>();
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.layer = document.createElement('div');
    this.layer.className = 'name-labels';
    scene.game.canvas.parentElement?.append(this.layer);
    this.camera = scene.cameras.main;
    this.camera.on(Phaser.Cameras.Scene2D.Events.POST_RENDER, this.place, this);
  }

  /** Shows the name of entity `id` above a sprite whose top is at `top` (world pixels). */
  set(id: number, name: string, top: { x: number; y: number }): void {
    let label = this.labels.get(id);
    if (!label) {
      const element = document.createElement('div');
      element.className = 'name-label';
      element.hidden = true; // Until placed.
      this.layer.append(element);
      label = { element, top };
      this.labels.set(id, label);
    }
    if (label.element.textContent !== name) {
      label.element.textContent = name;
    }
    label.top = top;
  }

  remove(id: number): void {
    this.labels.get(id)?.element.remove();
    this.labels.delete(id);
  }

  destroy(): void {
    this.camera.off(Phaser.Cameras.Scene2D.Events.POST_RENDER, this.place, this);
    this.layer.remove();
    this.labels.clear();
  }

  /** After the camera rendered: each name just above its character. */
  private place(camera: Phaser.Cameras.Scene2D.Camera): void {
    const view = camera.worldView;
    for (const { element, top } of this.labels.values()) {
      const x = (top.x - view.x) * camera.zoom + camera.x;
      const y = (top.y - view.y) * camera.zoom + camera.y - GAP_CSS_PX;
      element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      element.hidden = false;
    }
  }
}
