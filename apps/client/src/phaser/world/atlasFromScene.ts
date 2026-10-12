import type * as Phaser from 'phaser';
import { ATLAS_KEY } from '../../assets/atlas';
import type { Atlas } from '../../assets/registry';

/** The art atlas loaded by Phaser, as the asset registry wants it; undefined when there is none. */
export function atlasFromScene(scene: Phaser.Scene): Atlas | undefined {
  if (!scene.textures.exists(ATLAS_KEY)) {
    return undefined;
  }
  const texture = scene.textures.get(ATLAS_KEY);
  const frames = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const name of texture.getFrameNames()) {
    const frame = texture.get(name);
    frames.set(name, {
      x: frame.cutX,
      y: frame.cutY,
      width: frame.cutWidth,
      height: frame.cutHeight,
    });
  }
  return { image: texture.getSourceImage() as CanvasImageSource, frames };
}
