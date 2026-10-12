import * as Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const title = this.add
      .text(0, 0, '8Box', { fontFamily: 'monospace', fontSize: '48px', color: '#f4f4f4' })
      .setOrigin(0.5);

    const center = () => {
      title.setPosition(Math.round(this.scale.width / 2), Math.round(this.scale.height / 2));
    };
    center();
    this.scale.on(Phaser.Scale.Events.RESIZE, center);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, center);
    });
  }
}
