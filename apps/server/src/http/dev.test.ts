import { baseContent, LAYER, loadContent } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { World } from '../world/World';

const content = loadContent(baseContent);

function setup(withDevRoutes = true) {
  const world = World.generate({ seed: 1, content, layerSizeTiles: 64 });
  const app = buildApp(withDevRoutes ? { dev: { world, content } } : {});
  const post = (body: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/dev/tile', payload: body });
  return { world, post };
}

describe('POST /dev/tile', () => {
  it('changes a tile of the surface and marks its chunk for saving', async () => {
    const { world, post } = setup();
    world.takeDirtyChunks();

    const response = await post({ x: 5, y: 6, slot: 'object', tile: 'base:oak_tree' });

    expect(response.statusCode).toBe(200);
    expect(world.getTile(LAYER.surface, 5, 6, 'object')?.id).toBe('base:oak_tree');
    expect(world.takeDirtyChunks().map((chunk) => [chunk.cx, chunk.cy])).toEqual([[0, 0]]);
  });

  it('empties a slot with null', async () => {
    const { world, post } = setup();
    await post({ x: 5, y: 6, slot: 'object', tile: 'base:oak_tree' });

    expect((await post({ x: 5, y: 6, slot: 'object', tile: null })).statusCode).toBe(200);
    expect(world.getTile(LAYER.surface, 5, 6, 'object')).toBeUndefined();
  });

  it('refuses bad requests', async () => {
    const { post } = setup();
    for (const body of [
      { x: 5, y: 6, slot: 'object' },
      { x: 5.5, y: 6, slot: 'object', tile: null },
      { x: 999, y: 6, slot: 'object', tile: null },
      { x: 5, y: 6, slot: 'object', tile: 'base:nothing' },
      { x: 5, y: 6, slot: 'ground', tile: 'base:oak_tree' },
    ]) {
      expect((await post(body)).statusCode, JSON.stringify(body)).toBe(400);
    }
  });

  it('does not exist without the dev routes (production)', async () => {
    const { post } = setup(false);
    expect((await post({ x: 5, y: 6, slot: 'object', tile: null })).statusCode).toBe(404);
  });
});
