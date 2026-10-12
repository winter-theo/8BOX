/** Texture key of the art atlas in Phaser. */
export const ATLAS_KEY = 'atlas';

/** Where the art atlas lives (`apps/client/public/assets/`). Without it, placeholders are drawn. */
export const ATLAS_URLS = {
  image: 'assets/atlas.png',
  data: 'assets/atlas.json',
} as const;

/** Whether an atlas is published, checked without downloading it (avoids loader errors). */
export async function atlasExists(): Promise<boolean> {
  try {
    const response = await fetch(ATLAS_URLS.data, { method: 'HEAD' });
    // Some static hosts answer unknown paths with the index page: require JSON.
    return response.ok && (response.headers.get('content-type') ?? '').includes('json');
  } catch {
    return false;
  }
}
