import {
  closesRooms,
  type LayerId,
  roomOf,
  type TileDef,
  type TileMeta,
  type TileSlot,
  withRoom,
} from '@8box/shared';

/** What room detection reads and writes of the world (the `World`). */
export interface RoomTiles {
  readonly layerSizeTiles: number;
  isInside(x: number, y: number): boolean;
  getTile(layer: LayerId, x: number, y: number, slot: TileSlot): TileDef | undefined;
  getMeta(layer: LayerId, x: number, y: number): TileMeta | undefined;
  setMeta(layer: LayerId, x: number, y: number, meta: TileMeta | undefined): void;
}

/** The 4 sides of a tile: rooms are 4-connected. */
const SIDES: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Finds the rooms again around tile (x, y), where a wall or a door was just placed or removed. A room is
 * an area closed by walls and doors (open or not), of at most `maxTiles` tiles, that does not reach the
 * edge of the world. Each of its tiles has the room's id in its meta (`room`): the index (y × size + x)
 * of its first tile, unique since rooms never overlap, and stable while the room keeps that tile. Only
 * the rooms touching (x, y) can change: they are found again from the tile and its 4 sides, the tiles
 * that left a room lose its id (a broken wall opens it), and only the tiles whose room changed are
 * written (each write is sent to the clients).
 */
export function updateRoomsAround(
  world: RoomTiles,
  layer: LayerId,
  x: number,
  y: number,
  maxTiles: number,
): void {
  const size = world.layerSizeTiles;
  const around = [[x, y] as const, ...SIDES.map(([dx, dy]) => [x + dx, y + dy] as const)].filter(
    ([ax, ay]) => world.isInside(ax, ay),
  );
  // The rooms next to the tile now: tile index → room id.
  const next = new Map<number, number>();
  for (const [ax, ay] of around) {
    if (next.has(ay * size + ax) || closesRooms(world.getTile(layer, ax, ay, 'object'))) {
      continue;
    }
    const area = closedArea(world, layer, ax, ay, maxTiles);
    if (area) {
      const room = Math.min(...area);
      for (const index of area) {
        next.set(index, room);
      }
    }
  }
  // The tiles of the rooms that touched it before.
  const before = new Set<number>();
  for (const [ax, ay] of around) {
    const room = roomOf(world.getMeta(layer, ax, ay));
    if (room !== undefined && !before.has(ay * size + ax)) {
      collectRoom(world, layer, ax, ay, room, before);
    }
  }
  const setRoom = (index: number, room: number | undefined) => {
    const tx = index % size;
    const ty = Math.floor(index / size);
    const meta = world.getMeta(layer, tx, ty);
    if (roomOf(meta) !== room) {
      world.setMeta(layer, tx, ty, withRoom(meta, room));
    }
  };
  for (const index of before) {
    if (!next.has(index)) {
      setRoom(index, undefined);
    }
  }
  for (const [index, room] of next) {
    setRoom(index, room);
  }
}

/**
 * The area around tile (x, y) bounded by walls and doors, as tile indices; undefined when it is open:
 * larger than `maxTiles`, or reaching the edge of the world.
 */
export function closedArea(
  world: RoomTiles,
  layer: LayerId,
  x: number,
  y: number,
  maxTiles: number,
): number[] | undefined {
  const size = world.layerSizeTiles;
  const area = [y * size + x];
  const seen = new Set(area);
  for (let i = 0; i < area.length; i++) {
    const index = area[i] as number;
    const tx = index % size;
    const ty = Math.floor(index / size);
    for (const [dx, dy] of SIDES) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!world.isInside(nx, ny)) {
        return undefined;
      }
      const neighbor = ny * size + nx;
      if (seen.has(neighbor) || closesRooms(world.getTile(layer, nx, ny, 'object'))) {
        continue;
      }
      if (area.length >= maxTiles) {
        return undefined;
      }
      seen.add(neighbor);
      area.push(neighbor);
    }
  }
  return area;
}

/** Adds to `into` the tiles of room `room` connected to tile (x, y) (which belongs to it). */
function collectRoom(
  world: RoomTiles,
  layer: LayerId,
  x: number,
  y: number,
  room: number,
  into: Set<number>,
): void {
  const size = world.layerSizeTiles;
  const stack = [y * size + x];
  into.add(y * size + x);
  for (let index = stack.pop(); index !== undefined; index = stack.pop()) {
    const tx = index % size;
    const ty = Math.floor(index / size);
    for (const [dx, dy] of SIDES) {
      const nx = tx + dx;
      const ny = ty + dy;
      const neighbor = ny * size + nx;
      if (
        world.isInside(nx, ny) &&
        !into.has(neighbor) &&
        roomOf(world.getMeta(layer, nx, ny)) === room
      ) {
        into.add(neighbor);
        stack.push(neighbor);
      }
    }
  }
}
