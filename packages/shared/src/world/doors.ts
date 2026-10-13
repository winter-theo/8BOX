import type { TileDef } from '../content/schemas';
import type { TileMeta } from './chunk';

/** Whether the door of a tile is open, from the meta of the tile (closed when absent). */
export function isDoorOpen(meta: TileMeta | undefined): boolean {
  return meta?.open === true;
}

/** The meta of a door tile in that state: none when closed. */
export function doorMeta(open: boolean): TileMeta | undefined {
  return open ? { open: true } : undefined;
}

/** Whether a tile blocks movement, given the meta of its tile: an open door does not. */
export function tileBlocks(tile: TileDef, meta: TileMeta | undefined): boolean {
  return tile.solid && !(tile.door === true && isDoorOpen(meta));
}
