import { baseContent, loadContent } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { PALETTE } from './palette';
import { MISSING_PLACEHOLDER, placeholderFor } from './placeholders';
import { AssetRegistry, type Atlas, type CanvasFactory } from './registry';

/** Records the pixels drawn on each fake canvas. */
function fakeCanvases() {
  const canvases: Map<string, string>[] = [];
  const factory: CanvasFactory = () => {
    const pixels = new Map<string, string>();
    canvases.push(pixels);
    const context = {
      fillStyle: '' as string | CanvasGradient | CanvasPattern,
      fillRect(x: number, y: number) {
        pixels.set(`${x},${y}`, String(context.fillStyle));
      },
    };
    return { image: { pixels } as unknown as CanvasImageSource, context };
  };
  return { canvases, factory };
}

describe('placeholders', () => {
  it('exist for every tile, item and creature of the base content', () => {
    const content = loadContent(baseContent);
    const sprites = [...content.tiles.all, ...content.items.all, ...content.creatures.all].map(
      (entry) => entry.sprite,
    );
    expect(sprites.filter((sprite) => placeholderFor(sprite) === undefined)).toEqual([]);
  });

  it.each([
    'ground.grass',
    'ground.dirt',
    'ground.sand',
    'ground.shallow_water',
    'ground.deep_water',
  ])('cover every pixel of %s with palette colors', (id) => {
    const placeholder = placeholderFor(id);
    expect(placeholder).toBeDefined();
    const colors = new Set<string>(Object.values(PALETTE));
    for (let variant = 0; variant < (placeholder?.weights.length ?? 0); variant++) {
      const pixels = new Map<string, string>();
      placeholder?.draw((x, y, color) => pixels.set(`${x},${y}`, color), variant);
      expect(pixels.size).toBe(64);
      expect([...pixels.values()].every((color) => colors.has(color))).toBe(true);
    }
  });

  it('draws grass variants that differ', () => {
    const grass = placeholderFor('ground.grass');
    const draw = (variant: number) => {
      const pixels: string[] = [];
      grass?.draw((x, y, color) => pixels.push(`${x},${y}=${color}`), variant);
      return pixels.join(';');
    };
    expect(draw(0)).not.toBe(draw(1));
  });
});

describe('AssetRegistry', () => {
  it('draws a placeholder once per variant and reuses it', () => {
    const { canvases, factory } = fakeCanvases();
    const registry = new AssetRegistry(undefined, factory);

    // Sand weights 5, 5, 3, 1: numbers 0 to 4 pick the first variant, 5 to 9 the second.
    const a = registry.sprite('ground.sand', 0);
    const b = registry.sprite('ground.sand', 4);
    const c = registry.sprite('ground.sand', 5);

    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(canvases).toHaveLength(4);
    expect(a).toMatchObject({ sx: 0, sy: 0, width: 8, height: 8 });
  });

  it('uses the missing placeholder for an unknown sprite', () => {
    const { canvases, factory } = fakeCanvases();
    const registry = new AssetRegistry(undefined, factory);

    registry.sprite('obj.dragon');

    const pixels = canvases[0];
    const expected = new Map<string, string>();
    MISSING_PLACEHOLDER.draw((x, y, color) => expected.set(`${x},${y}`, color), 0);
    expect(pixels).toEqual(expected);
  });

  it('prefers the atlas frame when the atlas has the sprite', () => {
    const { canvases, factory } = fakeCanvases();
    const image = {} as CanvasImageSource;
    const atlas: Atlas = {
      image,
      frames: new Map([['ground.grass', { x: 16, y: 8, width: 8, height: 8 }]]),
    };
    const registry = new AssetRegistry(atlas, factory);

    expect(registry.sprite('ground.grass', 1)).toEqual({
      image,
      sx: 16,
      sy: 8,
      width: 8,
      height: 8,
    });
    expect(registry.fromAtlas('ground.grass')).toBe(true);
    expect(registry.fromAtlas('ground.sand')).toBe(false);
    registry.sprite('ground.sand');
    // Only the sand placeholder (4 variants) was drawn: grass comes from the atlas.
    expect(canvases).toHaveLength(4);
  });
});

describe('AssetRegistry.optional', () => {
  it('returns nothing for a sprite without art, instead of the missing checker', () => {
    const { canvases, factory } = fakeCanvases();
    const registry = new AssetRegistry(undefined, factory);

    expect(registry.optional('ground.lava.edge.n')).toBeUndefined();
    expect(canvases).toHaveLength(0);
  });

  it('draws edge overlays that leave most of the tile transparent', () => {
    const { canvases, factory } = fakeCanvases();
    const registry = new AssetRegistry(undefined, factory);

    expect(registry.optional('ground.grass.edge.n')).toBeDefined();
    const pixels = canvases[0];
    expect(pixels?.size).toBeGreaterThan(8);
    expect(pixels?.size).toBeLessThan(32);
    expect(pixels?.get('0,7')).toBeUndefined();
  });
});
