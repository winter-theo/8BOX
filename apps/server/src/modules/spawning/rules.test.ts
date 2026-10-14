import {
  baseContent,
  createMovementWorld,
  createRng,
  loadContent,
  type TileMeta,
  type TileSlot,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import {
  canSpawnAt,
  farFromAll,
  nightCreatures,
  pickCreature,
  ringTile,
  type SpawnWorld,
  underCaps,
} from './rules';

const content = loadContent(baseContent);

/** A world of grass in the dark, where some tiles hold something else. */
function worldOf(options: {
  tiles?: Record<string, Partial<Record<TileSlot, string>>>;
  meta?: Record<string, TileMeta>;
  lit?: readonly string[];
  safe?: readonly string[];
}): SpawnWorld {
  const tileAt = (x: number, y: number, slot: TileSlot) => {
    const id =
      options.tiles?.[`${x},${y}`]?.[slot] ?? (slot === 'ground' ? 'base:grass' : undefined);
    return id === undefined ? undefined : content.tiles.require(id);
  };
  const metaAt = (x: number, y: number) => options.meta?.[`${x},${y}`];
  return {
    movement: createMovementWorld(tileAt, () => true, metaAt),
    tileAt,
    metaAt,
    inSafeZone: (x, y) => options.safe?.includes(`${x},${y}`) ?? false,
    isLit: (x, y) => options.lit?.includes(`${x},${y}`) ?? false,
  };
}

describe('canSpawnAt', () => {
  it('allows a dark tile of open ground, out of the safe zone', () => {
    expect(canSpawnAt(worldOf({}), 3, 3)).toBe(true);
  });

  it('refuses a lit tile and a tile of the safe zone', () => {
    expect(canSpawnAt(worldOf({ lit: ['3,3'] }), 3, 3)).toBe(false);
    expect(canSpawnAt(worldOf({ safe: ['3,3'] }), 3, 3)).toBe(false);
  });

  it('refuses water, shallow or deep', () => {
    const world = worldOf({
      tiles: { '1,1': { ground: 'base:shallow_water' }, '2,2': { ground: 'base:deep_water' } },
    });
    expect(canSpawnAt(world, 1, 1)).toBe(false);
    expect(canSpawnAt(world, 2, 2)).toBe(false);
  });

  it('refuses a tile that blocks, a built floor and the inside of a room', () => {
    const world = worldOf({
      tiles: {
        '1,1': { object: 'base:oak_tree' },
        '2,2': { floor: 'base:wooden_floor' },
      },
      meta: { '3,3': { room: 7 } },
    });
    expect(canSpawnAt(world, 1, 1)).toBe(false);
    expect(canSpawnAt(world, 2, 2)).toBe(false);
    expect(canSpawnAt(world, 3, 3)).toBe(false);
  });
});

describe('ringTile', () => {
  it('picks tiles between the two radii, all around', () => {
    const rng = createRng(3);
    const sides = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const tile = ringTile(rng, 100.5, 100.5, 18, 32);
      const distance = Math.hypot(tile.x + 0.5 - 100.5, tile.y + 0.5 - 100.5);
      expect(distance).toBeGreaterThanOrEqual(17);
      expect(distance).toBeLessThanOrEqual(33);
      sides.add(`${tile.x >= 100},${tile.y >= 100}`);
    }
    expect(sides.size).toBe(4);
  });
});

describe('farFromAll and underCaps', () => {
  it('keeps monsters away from every player', () => {
    const players = [
      { x: 0.5, y: 0.5 },
      { x: 40.5, y: 0.5 },
    ];
    expect(farFromAll(20, 0, players, 18)).toBe(true);
    expect(farFromAll(25, 0, players, 18)).toBe(false);
  });

  it('stops at 6 monsters for a player and 150 in all', () => {
    const caps = { maxPerPlayer: 6, maxTotal: 150 };
    expect(underCaps(5, 100, caps)).toBe(true);
    expect(underCaps(6, 100, caps)).toBe(false);
    expect(underCaps(0, 150, caps)).toBe(false);
  });
});

describe('pickCreature', () => {
  it('picks the night creatures by their weight', () => {
    const creatures = nightCreatures(content.creatures.all);
    expect(creatures.map((creature) => creature.id).sort()).toEqual(['base:prowler', 'base:slime']);
    const rng = createRng(5);
    let slimes = 0;
    for (let i = 0; i < 3000; i++) {
      if (pickCreature(creatures, rng)?.id === 'base:slime') {
        slimes++;
      }
    }
    // Slimes weigh 2, prowlers 1.
    expect(slimes / 3000).toBeGreaterThan(0.6);
    expect(slimes / 3000).toBeLessThan(0.73);
    expect(pickCreature([], rng)).toBeUndefined();
  });
});
