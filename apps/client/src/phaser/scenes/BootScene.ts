import * as Phaser from 'phaser';
import { ATLAS_KEY, ATLAS_URLS, atlasExists } from '../../assets/atlas';

/** Loads the art atlas when one is published, then starts the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    // The game can be destroyed before the atlas check answers (React remounts it in dev).
    let destroyed = false;
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      destroyed = true;
    });
    const startWorld = () => {
      if (!destroyed) {
        this.scene.start('world');
      }
    };
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
