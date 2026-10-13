import type { TileDef } from '../content/schemas';
import type { TileMeta } from './chunk';

/**
 * Room of a tile, from its meta (`room`): the id of the closed area it belongs to, which gets a roof.
 * Undefined outside rooms. The server finds the rooms; the clients only read this.
 */
export function roomOf(meta: TileMeta | undefined): number | undefined {
  const room = meta?.room;
  return typeof room === 'number' ? room : undefined;
}

/** The meta of a tile with its room set (`undefined`: none), the rest kept; undefined when empty. */
export function withRoom(
  meta: TileMeta | undefined,
  room: number | undefined,
): TileMeta | undefined {
  const rest = Object.entries(meta ?? {}).filter(([key]) => key !== 'room');
  const next: TileMeta = Object.fromEntries(rest);
  if (room !== undefined) {
    next.room = room;
  }
  return Object.keys(next).length === 0 ? undefined : next;
}

/**
 * What remains of the meta of a tile when its object changes: its room. The rest (an open door)
 * belonged to the object.
 */
export function metaAfterObjectChange(meta: TileMeta | undefined): TileMeta | undefined {
  return withRoom(undefined, roomOf(meta));
}

/** Whether an object closes rooms: a wall or a door (open or not). */
export function closesRooms(tile: TileDef | undefined): boolean {
  return tile?.wall === true || tile?.door === true;
}
