import { CONFIG, LAYER, roomOf } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { createTestContext } from '../core/testing';
import { updateRoomsAround } from './rooms';
import type { World } from './World';

const MAX = CONFIG.building.maxRoofedRoomTiles;
const WALL = 'base:wooden_wall';
const DOOR = 'base:wooden_door';
const S = LAYER.surface;

/** Puts an object on (x, y) (`null` removes it) and finds the rooms again, as the building module does. */
function put(world: World, x: number, y: number, tile: string | null): void {
  world.setTile(S, x, y, 'object', tile);
  updateRoomsAround(world, S, x, y, MAX);
}

/** The tiles around the area [left, left + width) × [top, top + height): its walls. */
function ring(left: number, top: number, width: number, height: number): [number, number][] {
  const tiles: [number, number][] = [];
  for (let x = left - 1; x <= left + width; x++) {
    tiles.push([x, top - 1], [x, top + height]);
  }
  for (let y = top; y < top + height; y++) {
    tiles.push([left - 1, y], [left + width, y]);
  }
  return tiles;
}

/** Walls around the area, and a door instead of the first wall below it. */
function build(world: World, left: number, top: number, width: number, height: number): void {
  for (const [x, y] of ring(left, top, width, height)) {
    put(world, x, y, x === left && y === top + height ? DOOR : WALL);
  }
}

/** Rooms of the tiles of the area [left, left + width) × [top, top + height). */
function roomsIn(world: World, left: number, top: number, width: number, height: number) {
  const rooms = new Set<number | undefined>();
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      rooms.add(roomOf(world.getMeta(S, x, y)));
    }
  }
  return [...rooms];
}

function setup(): World {
  return createTestContext().ctx.world;
}

describe('rooms', () => {
  it('roofs an area closed by walls and a door, with the index of its first tile', () => {
    const world = setup();
    build(world, 10, 10, 3, 3);
    expect(roomsIn(world, 10, 10, 3, 3)).toEqual([10 * world.layerSizeTiles + 10]);
    // The walls, the door and the outside are not in the room.
    expect(roomOf(world.getMeta(S, 9, 10))).toBeUndefined();
    expect(roomOf(world.getMeta(S, 10, 13))).toBeUndefined();
    expect(roomOf(world.getMeta(S, 8, 8))).toBeUndefined();
  });

  it('roofs nothing while the area is open, and opens the room when a wall breaks', () => {
    const world = setup();
    const walls = ring(10, 10, 3, 3);
    // The last tile is on a side: a missing corner does not open a room (it is closed side by side).
    const [x0, y0] = walls.pop() ?? [0, 0];
    for (const [x, y] of walls) {
      put(world, x, y, WALL);
    }
    expect(roomsIn(world, 10, 10, 3, 3)).toEqual([undefined]);
    put(world, x0, y0, DOOR);
    expect(roomsIn(world, 10, 10, 3, 3)).toHaveLength(1);
    expect(roomsIn(world, 10, 10, 3, 3)[0]).toBeTypeOf('number');
    put(world, 12, 9, null);
    expect(roomsIn(world, 10, 10, 3, 3)).toEqual([undefined]);
    expect(roomOf(world.getMeta(S, 12, 9))).toBeUndefined();
  });

  it(`roofs a room of ${MAX} tiles, not a larger one`, () => {
    const world = setup();
    build(world, 10, 10, 8, MAX / 8);
    expect(roomsIn(world, 10, 10, 8, MAX / 8)).toHaveLength(1);
    expect(roomsIn(world, 10, 10, 8, MAX / 8)[0]).toBeTypeOf('number');
    const large = setup();
    build(large, 10, 10, 9, MAX / 8);
    expect(roomsIn(large, 10, 10, 9, MAX / 8)).toEqual([undefined]);
  });

  it('gives two rooms sharing a wall their own ids, and one when the wall between breaks', () => {
    const world = setup();
    build(world, 10, 10, 3, 3);
    build(world, 14, 10, 3, 3);
    const left = roomsIn(world, 10, 10, 3, 3);
    const right = roomsIn(world, 14, 10, 3, 3);
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(1);
    expect(left[0]).not.toBe(right[0]);
    put(world, 13, 11, null);
    expect(roomsIn(world, 10, 10, 3, 3)).toEqual(left);
    expect(roomsIn(world, 14, 10, 3, 3)).toEqual(left);
    expect(roomOf(world.getMeta(S, 13, 11))).toBe(left[0]);
    // A wall placed inside a room cuts it in two again.
    put(world, 13, 11, WALL);
    expect(roomsIn(world, 14, 10, 3, 3)).toEqual(right);
    expect(roomOf(world.getMeta(S, 13, 11))).toBeUndefined();
  });

  it('keeps the room of a tile when its object changes', () => {
    const world = setup();
    build(world, 10, 10, 3, 3);
    const [room] = roomsIn(world, 10, 10, 3, 3);
    world.setTile(S, 11, 11, 'object', 'base:bed');
    expect(roomOf(world.getMeta(S, 11, 11))).toBe(room);
  });

  it(`finds a room of ${MAX} tiles again in less than 2 ms`, () => {
    const world = setup();
    build(world, 10, 10, 8, MAX / 8);
    const runs = 50;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      put(world, 9, 12, null);
      put(world, 9, 12, WALL);
    }
    const ms = (performance.now() - start) / (2 * runs);
    expect(ms).toBeLessThan(2);
    expect(roomsIn(world, 10, 10, 8, MAX / 8)).toHaveLength(1);
  });
});
