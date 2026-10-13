import { AssetRegistry } from './registry';

/** Placeholders until the world scene shares its registry (with the atlas, when there is one). */
let registry = new AssetRegistry(undefined);
/** Sprite id → image URL, drawn once. */
const urls = new Map<string, string>();

/** The registry the icons come from: the one of the world scene, so that the HUD shows the same art. */
export function shareRegistryWithIcons(shared: AssetRegistry): void {
  registry = shared;
  urls.clear();
}

/** An image URL of a sprite at its own size (scale it up with `image-rendering: pixelated`). */
export function spriteUrl(spriteId: string): string {
  let url = urls.get(spriteId);
  if (url === undefined) {
    const source = registry.sprite(spriteId);
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    canvas
      .getContext('2d')
      ?.drawImage(
        source.image,
        source.sx,
        source.sy,
        source.width,
        source.height,
        0,
        0,
        source.width,
        source.height,
      );
    url = canvas.toDataURL();
    urls.set(spriteId, url);
  }
  return url;
}
