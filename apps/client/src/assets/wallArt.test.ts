import { baseContent, loadContent, type TileDef } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { placeholderFor } from './placeholders';
import {
  joinsWalls,
  objectSpriteId,
  openDoorSpriteId,
  SIDE_BITS,
  WALL_MASKS,
  wallMask,
  wallSpriteId,
  wallSuffix,
} from './wallArt';

const content = loadContent(baseContent);
const WALL = content.tiles.get('base:wooden_wall') as TileDef;
const DOOR = content.tiles.get('base:wooden_door') as TileDef;

/**
 * The wall sprites of a little map: 'W' a wall, 'D' a door, 'T' a tree, '.' nothing. Returns the
 * suffix of the sprite of each wall, in the same layout ('.' elsewhere).
 */
function drawWalls(rows: readonly string[]): string[] {
  const tileAt = (x: number, y: number): TileDef | undefined => {
    const char = rows[y]?.[x];
    return char === 'W'
      ? WALL
      : char === 'D'
        ? DOOR
        : char === 'T'
          ? content.tiles.get('base:oak_tree')
          : undefined;
  };
  return rows.map((row, y) =>
    [...row]
      .map((char, x) => {
        const tile = tileAt(x, y);
        if (char !== 'W' || !tile) {
          return '.';
        }
        return objectSpriteId(tile, x, y, undefined, tileAt).replace('obj.wooden_wall.', '');
      })
      .join(' '),
  );
}

describe('wall joins (neighbors → sprite)', () => {
  it('names each set of joined sides in the order n, e, s, w', () => {
    const table = Array.from({ length: WALL_MASKS }, (_, mask) => wallSuffix(mask));
    expect(table).toEqual([
      'none',
      'n',
      'e',
      'ne',
      's',
      'ns',
      'es',
      'nes',
      'w',
      'nw',
      'ew',
      'new',
      'sw',
      'nsw',
      'esw',
      'nesw',
    ]);
    expect(wallMask(5, 5, (x, y) => x === 5 && y === 4)).toBe(SIDE_BITS.n);
    expect(wallMask(5, 5, (x, y) => y === 5 && x !== 5)).toBe(SIDE_BITS.e | SIDE_BITS.w);
    expect(wallSpriteId('obj.wooden_wall', SIDE_BITS.s)).toBe('obj.wooden_wall.s');
  });

  it('joins a line, an angle and a cross', () => {
    expect(drawWalls(['WWW'])).toEqual(['e ew w']);
    expect(drawWalls(['W', 'W', 'W'])).toEqual(['s', 'ns', 'n']);
    expect(drawWalls(['WW', 'W.'])).toEqual(['es w', 'n .']);
    expect(drawWalls(['.W.', 'WWW', '.W.'])).toEqual(['. s .', 'e nesw w', '. n .']);
    expect(drawWalls(['WWW', '.W.'])).toEqual(['e esw w', '. n .']);
    expect(drawWalls(['W'])).toEqual(['none']);
  });

  it('joins doors but not other objects', () => {
    expect(drawWalls(['WDW'])).toEqual(['e . w']);
    expect(drawWalls(['TWT'])).toEqual(['. none .']);
    expect(joinsWalls(DOOR)).toBe(true);
    expect(joinsWalls(undefined)).toBe(false);
  });

  it('shows an open door open, and other objects as their tile', () => {
    expect(objectSpriteId(DOOR, 0, 0, undefined, () => undefined)).toBe('obj.wooden_door');
    expect(objectSpriteId(DOOR, 0, 0, { open: true }, () => undefined)).toBe(
      openDoorSpriteId('obj.wooden_door'),
    );
    const bed = content.tiles.get('base:bed') as TileDef;
    expect(objectSpriteId(bed, 0, 0, { open: true }, () => WALL)).toBe('obj.bed');
  });

  it('has a placeholder for every joined wall and for the open door', () => {
    for (let mask = 0; mask < WALL_MASKS; mask++) {
      const placeholder = placeholderFor(wallSpriteId('obj.wooden_wall', mask));
      expect([placeholder?.width, placeholder?.height]).toEqual([8, 16]);
    }
    expect(placeholderFor('obj.wooden_door.open')).toBeDefined();
  });

  it('shows the front face of a wall only without a wall below', () => {
    const pixels = (mask: number) => {
      const rows: string[][] = Array.from({ length: 16 }, () => Array(8).fill('.'));
      placeholderFor(wallSpriteId('obj.wooden_wall', mask))?.draw((x, y, color) => {
        (rows[y] as string[])[x] = color;
      }, 0);
      return rows;
    };
    const alone = pixels(0);
    const withBelow = pixels(SIDE_BITS.s);
    // Same top; below it, the face (its foot in shadow) or more top.
    expect(withBelow.slice(0, 7)).toEqual(alone.slice(0, 7));
    expect(alone[15]).not.toEqual(withBelow[15]);
    expect(withBelow[15]).toEqual(withBelow[9]);
  });
});
