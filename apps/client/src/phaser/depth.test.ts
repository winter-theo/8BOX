import { WORLD } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { DEPTH, entityAnchor, objectAnchor, sortDepth } from './depth';

const TILE_PX = WORLD.tileSizePx;

/** Draw order of sprites, back to front, as Phaser sorts them by depth. */
function drawOrder(sprites: { name: string; depth: number }[]): string[] {
  return [...sprites].sort((a, b) => a.depth - b.depth).map((sprite) => sprite.name);
}

describe('objectAnchor', () => {
  it('anchors an object at the middle of the bottom edge of its tile', () => {
    expect(objectAnchor(10, 20)).toEqual({ x: 10.5 * TILE_PX, y: 21 * TILE_PX });
  });

  it('makes a tall sprite rise over the tile above', () => {
    const anchor = objectAnchor(3, 7);
    const top = anchor.y - 2 * TILE_PX; // 8 × 16 sprite
    expect(top).toBe(6 * TILE_PX);
    expect(anchor.x - TILE_PX / 2).toBe(3 * TILE_PX);
  });
});

describe('entityAnchor', () => {
  it('anchors an entity at its feet, in world pixels', () => {
    expect(entityAnchor({ x: 512.5, y: 300.25 })).toEqual({
      x: 512.5 * TILE_PX,
      y: 300.25 * TILE_PX,
    });
  });
});

describe('sortDepth', () => {
  const tree = { name: 'tree', depth: sortDepth(objectAnchor(10, 10).y, 'object') };

  it('hides an entity behind a tree under the foliage', () => {
    // Feet in the tile above the trunk: the entity is drawn first, the foliage covers it.
    const behind = {
      name: 'entity',
      depth: sortDepth(entityAnchor({ x: 10.5, y: 10.4 }).y, 'entity'),
    };
    expect(drawOrder([tree, behind])).toEqual(['entity', 'tree']);
  });

  it('draws an entity in front of a tree over it', () => {
    const front = {
      name: 'entity',
      depth: sortDepth(entityAnchor({ x: 10.5, y: 11.6 }).y, 'entity'),
    };
    expect(drawOrder([front, tree])).toEqual(['tree', 'entity']);
  });

  it('draws an entity standing on the base line of an object over it', () => {
    const onLine = {
      name: 'entity',
      depth: sortDepth(entityAnchor({ x: 10.5, y: 11 }).y, 'entity'),
    };
    expect(drawOrder([onLine, tree])).toEqual(['tree', 'entity']);
  });

  it('draws the objects of lower rows in front', () => {
    const below = { name: 'grass', depth: sortDepth(objectAnchor(10, 11).y, 'object') };
    expect(drawOrder([below, tree])).toEqual(['tree', 'grass']);
  });

  it('keeps every sorted sprite above the ground', () => {
    expect(sortDepth(objectAnchor(0, 0).y, 'object')).toBeGreaterThan(DEPTH.ground);
  });
});
