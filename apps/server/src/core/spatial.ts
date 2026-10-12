import { WORLD } from '@8box/shared';

/** Position in the world: layer index and tile coordinates (tile units, fractional). */
export interface Position {
  readonly layer: number;
  readonly x: number;
  readonly y: number;
}

export interface ChunkRef {
  layer: number;
  cx: number;
  cy: number;
}

/** Chunk coordinate containing a tile coordinate. */
export function chunkCoord(tile: number): number {
  return Math.floor(tile / WORLD.chunkSizeTiles);
}

function cellKey(layer: number, cx: number, cy: number): string {
  return `${layer}:${cx}:${cy}`;
}

const EMPTY: ReadonlySet<number> = new Set();

/** Ids of the entities in each chunk of each layer. Kept up to date by the EntityStore. */
export class SpatialIndex {
  private readonly cells = new Map<string, Set<number>>();
  private readonly cellOfEntity = new Map<number, string>();

  /** Places or moves an entity. Returns true when it entered another chunk. */
  update(entity: number, position: Position): boolean {
    const key = cellKey(position.layer, chunkCoord(position.x), chunkCoord(position.y));
    const previous = this.cellOfEntity.get(entity);
    if (previous === key) {
      return false;
    }
    if (previous !== undefined) {
      this.removeFromCell(previous, entity);
    }
    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }
    cell.add(entity);
    this.cellOfEntity.set(entity, key);
    return true;
  }

  remove(entity: number): void {
    const key = this.cellOfEntity.get(entity);
    if (key !== undefined) {
      this.removeFromCell(key, entity);
      this.cellOfEntity.delete(entity);
    }
  }

  inChunk({ layer, cx, cy }: ChunkRef): ReadonlySet<number> {
    return this.cells.get(cellKey(layer, cx, cy)) ?? EMPTY;
  }

  private removeFromCell(key: string, entity: number): void {
    const cell = this.cells.get(key);
    cell?.delete(entity);
    if (cell?.size === 0) {
      this.cells.delete(key);
    }
  }
}
