import * as Phaser from 'phaser';
import { ATLAS_KEY, ATLAS_URLS, atlasExists } from '../../assets/atlas';

/** Loads the art atlas when one is published, then starts the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const startWorld = () => this.scene.start('world');
    void atlasExists().then((exists) => {
      if (!exists) {
        startWorld();
        return;
      }
      this.load.atlas(ATLAS_KEY, ATLAS_URLS.image, ATLAS_URLS.data);
      this.load.once(Phaser.Loader.Events.COMPLETE, startWorld);
      this.load.start();
    });
  }
}
