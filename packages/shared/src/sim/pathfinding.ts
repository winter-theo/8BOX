import type { TilePoint } from '../actions/aim';
import type { MovementWorld } from './movement';

/**
 * What a tile is to a walker looking for a path: walked through (`open`), broken through (`wall`: a
 * wall or a closed door in the way of a monster), or never crossed (`blocked`).
 */
export type PathTile = 'open' | 'wall' | 'blocked';

/** The tiles as a path search sees them. Coordinates are whole tile coordinates. */
export interface PathGrid {
  tileAt(x: number, y: number): PathTile;
}

export interface PathOptions {
  /** The search stays in the square of this half side around the start, in tiles. */
  radiusTiles: number;
  /** Cost of entering a wall tile, in tiles of walking; absent: walls are never crossed. */
  wallCost?: number;
}

/**
 * Path view of the tiles: what blocks movement is a `wall` when `breakableAt` says it can be broken
 * through, otherwise `blocked`.
 */
export function createPathGrid(
  movement: MovementWorld,
  breakableAt: (x: number, y: number) => boolean,
): PathGrid {
  return {
    tileAt: (x, y) => {
      if (!movement.isSolid(x, y)) {
        return 'open';
      }
      return breakableAt(x, y) ? 'wall' : 'blocked';
    },
  };
}

/** Steps to the 8 neighbours: straight ones first. */
const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const TILE_CODES: Readonly<Record<PathTile, number>> = { open: 1, wall: 2, blocked: 3 };
const UNKNOWN = 0;

/** Estimate of the cost between two tiles (8 directions, every tile costing at least its length). */
function octile(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax + ay + (Math.SQRT2 - 2) * Math.min(ax, ay);
}

/**
 * Cheapest path on the grid of tiles from tile `from` to tile `to`, with A*: the tiles to walk through
 * in order, `to` included and `from` excluded (empty when they are the same tile); undefined when
 * there is none within the search square. Moves go to the 8 neighbours. A diagonal move needs open
 * tiles on both sides, so that the box of a walker never cuts a corner. Entering an open tile costs
 * its length (1, or √2 diagonally); a wall tile is only entered straight, and costs `wallCost`.
 */
export function findPath(
  grid: PathGrid,
  from: TilePoint,
  to: TilePoint,
  options: PathOptions,
): TilePoint[] | undefined {
  const radius = Math.floor(options.radiusTiles);
  const size = radius * 2 + 1;
  const minX = from.x - radius;
  const minY = from.y - radius;
  const inside = (x: number, y: number) =>
    x >= minX && y >= minY && x < minX + size && y < minY + size;
  if (!inside(to.x, to.y)) {
    return undefined;
  }
  const indexOf = (x: number, y: number) => (y - minY) * size + (x - minX);
  const area = size * size;
  const kinds = new Uint8Array(area);
  const kindAt = (x: number, y: number): number => {
    if (!inside(x, y)) {
      return TILE_CODES.blocked;
    }
    const index = indexOf(x, y);
    let kind = kinds[index] ?? UNKNOWN;
    if (kind === UNKNOWN) {
      kind = TILE_CODES[grid.tileAt(x, y)];
      kinds[index] = kind;
    }
    return kind;
  };
  if (kindAt(to.x, to.y) !== TILE_CODES.open) {
    return undefined;
  }

  const cost = new Float64Array(area).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(area).fill(-1);
  const closed = new Uint8Array(area);
  const open = new MinHeap();
  const start = indexOf(from.x, from.y);
  const goal = indexOf(to.x, to.y);
  cost[start] = 0;
  open.push(start, octile(to.x - from.x, to.y - from.y));

  while (open.size > 0) {
    const current = open.pop();
    if (current === goal) {
      return pathTo(goal, start, cameFrom, size, minX, minY);
    }
    if (closed[current]) {
      continue;
    }
    closed[current] = 1;
    const x = minX + (current % size);
    const y = minY + Math.floor(current / size);
    const here = cost[current] ?? 0;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      const kind = kindAt(nx, ny);
      let step: number;
      if (dx !== 0 && dy !== 0) {
        const clear =
          kind === TILE_CODES.open &&
          kindAt(nx, y) === TILE_CODES.open &&
          kindAt(x, ny) === TILE_CODES.open;
        if (!clear) {
          continue;
        }
        step = Math.SQRT2;
      } else if (kind === TILE_CODES.open) {
        step = 1;
      } else if (kind === TILE_CODES.wall && options.wallCost !== undefined) {
        step = options.wallCost;
      } else {
        continue;
      }
      const next = indexOf(nx, ny);
      const nextCost = here + step;
      if (closed[next] || nextCost >= (cost[next] ?? 0)) {
        continue;
      }
      cost[next] = nextCost;
      cameFrom[next] = current;
      open.push(next, nextCost + octile(to.x - nx, to.y - ny));
    }
  }
  return undefined;
}

function pathTo(
  goal: number,
  start: number,
  cameFrom: Int32Array,
  size: number,
  minX: number,
  minY: number,
): TilePoint[] {
  const path: TilePoint[] = [];
  for (let index = goal; index !== start; index = cameFrom[index] ?? start) {
    path.push({ x: minX + (index % size), y: minY + Math.floor(index / size) });
  }
  return path.reverse();
}

/**
 * The wall to hit for a walker that follows `path` (from `findPath` with a `wallCost`): its next tile,
 * when that tile is a wall or a closed door; undefined when the way ahead is open.
 */
export function wallAhead(path: readonly TilePoint[], grid: PathGrid): TilePoint | undefined {
  const next = path[0];
  return next && grid.tileAt(next.x, next.y) === 'wall' ? next : undefined;
}

/** Binary heap of indexes by priority, lowest first (repeated indexes allowed). */
class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    const { items, priorities } = this;
    let i = items.length;
    items.push(item);
    priorities.push(priority);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((priorities[parent] ?? 0) <= priority) {
        break;
      }
      items[i] = items[parent] ?? 0;
      priorities[i] = priorities[parent] ?? 0;
      i = parent;
    }
    items[i] = item;
    priorities[i] = priority;
  }

  /** Removes and returns the item of lowest priority (the heap must not be empty). */
  pop(): number {
    const { items, priorities } = this;
    const top = items[0] ?? 0;
    const lastItem = items.pop() ?? 0;
    const lastPriority = priorities.pop() ?? 0;
    const count = items.length;
    if (count === 0) {
      return top;
    }
    let i = 0;
    for (;;) {
      const left = i * 2 + 1;
      if (left >= count) {
        break;
      }
      const right = left + 1;
      const child =
        right < count && (priorities[right] ?? 0) < (priorities[left] ?? 0) ? right : left;
      if ((priorities[child] ?? 0) >= lastPriority) {
        break;
      }
      items[i] = items[child] ?? 0;
      priorities[i] = priorities[child] ?? 0;
      i = child;
    }
    items[i] = lastItem;
    priorities[i] = lastPriority;
    return top;
  }
}
