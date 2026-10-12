import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

const BACKGROUND_COLOR = '#1b1b24';

/** Creates the Phaser game inside `parent`, filling it and following its size. */
export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    backgroundColor: BACKGROUND_COLOR,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [BootScene],
  });
}
