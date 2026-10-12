import { describe, expect, it } from 'vitest';
import { type GroundLookup, planGroundTile } from './groundArt';
import { placeholderFor } from './placeholders';

const IDS: Record<string, string> = {
  g: 'ground.grass',
  o: 'ground.dirt',
  a: 'ground.sand',
  w: 'ground.shallow_water',
  D: 'ground.deep_water',
};

/** A small map: one character per tile (see IDS); outside the rows the tiles are unknown. */
function grid(rows: string[], floors: Record<string, string> = {}): GroundLookup {
  return (x, y) => {
    const char = rows[y]?.[x];
    if (char === undefined || char === ' ') {
      return undefined;
    }
    return { ground: IDS[char], floor: floors[`${x},${y}`] };
  };
}

const sprites = (x: number, y: number, lookup: GroundLookup) =>
  planGroundTile(x, y, lookup).map((draw) => draw.sprite);

describe('planGroundTile', () => {
  it('draws a lone tile as its own ground', () => {
    expect(sprites(1, 1, grid(['aaa', 'aaa', 'aaa']))).toEqual(['ground.sand']);
  });

  it('spills a higher neighbor over the side that faces it', () => {
    const lookup = grid(['ggg', 'aaa', 'aaa']);

    expect(sprites(1, 1, lookup)).toEqual(['ground.sand', 'ground.grass.edge.n']);
    expect(sprites(1, 0, lookup)).toHaveLength(1); // the grass itself stays plain
  });

  it('adds foam on water along the shore, under the edge', () => {
    const lookup = grid(['wwa', 'wwa', 'wwa']);

    expect(sprites(1, 1, lookup)).toEqual([
      'ground.shallow_water',
      'ground.shallow_water.shore.e',
      'ground.sand.edge.e',
    ]);
  });

  it('rounds an inner corner only when no side already has that edge', () => {
    expect(sprites(1, 1, grid(['aag', 'aaa', 'aaa']))).toEqual([
      'ground.sand',
      'ground.grass.edge.ne',
    ]);
    expect(sprites(1, 1, grid(['agg', 'aaa', 'aaa']))).toEqual([
      'ground.sand',
      'ground.grass.edge.n',
    ]);
  });

  it('stacks edges from the lowest ground to the highest', () => {
    const lookup = grid(['aoa', 'Dag', 'aaa']);

    expect(sprites(1, 1, lookup)).toEqual([
      'ground.sand',
      'ground.dirt.edge.n',
      'ground.grass.edge.e',
    ]);
  });

  it('draws no edge toward an unknown tile', () => {
    expect(sprites(0, 0, grid(['a ', '  ']))).toEqual(['ground.sand']);
  });

  it('draws the floor on top, with itself as fallback', () => {
    const draws = planGroundTile(1, 1, grid(['ggg', 'gag', 'ggg'], { '1,1': 'floor.planks' }));

    expect(draws.at(-1)).toMatchObject({ sprite: 'floor.planks', fallback: 'floor.planks' });
  });

  it('turns some grass into lush patches that fall back to plain grass', () => {
    const rows = Array.from({ length: 64 }, () => 'g'.repeat(64));
    const lookup = grid(rows);
    let patches = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const [base] = planGroundTile(x, y, lookup);
        if (base?.sprite === 'ground.grass.patch') {
          expect(base.fallback).toBe('ground.grass');
          patches++;
        }
      }
    }
    expect(patches / (64 * 64)).toBeGreaterThan(0.05);
    expect(patches / (64 * 64)).toBeLessThan(0.5);
  });

  it('only asks for sprites that have a placeholder', () => {
    const lookup = grid(['gDao', 'wagw', 'oDwa', 'gaog']);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        for (const draw of planGroundTile(x, y, lookup)) {
          expect(placeholderFor(draw.sprite), draw.sprite).toBeDefined();
        }
      }
    }
  });
});
