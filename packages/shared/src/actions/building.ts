import { INTERACTION } from '../config/interaction';
import { PLAYER } from '../config/player';
import type { Content } from '../content/load';
import type { TileDef, TileSlot } from '../content/schemas';
import { heldStack } from '../inventory/inventory';
import { isDoorOpen } from '../world/doors';
import { inSafeZone } from '../world/safeZone';
import type { ActionDef, ActionSubject, Actor } from './actions';
import type { TilePoint } from './aim';
import { tileTarget } from './harvest';

/** Margin that keeps a box flush against a tile edge from counting as inside the tile, in tiles. */
const EDGE_EPSILON = 1e-6;

/** The tile the item in hand places (`place` of the item), if any. */
export function heldPlaceable(actor: Actor, content: Content): TileDef | undefined {
  const held = heldStack(actor.inventory);
  const place = held ? content.items.get(held.item)?.place : undefined;
  return place === undefined ? undefined : content.tiles.get(place);
}

/**
 * Whether a tile is free for `tile`: its slot and the object slot are empty (nothing goes under a tree
 * or a wall), and its ground does not block (deep water).
 */
export function hasRoomFor(
  tiles: Partial<Record<TileSlot, string>>,
  tile: TileDef,
  content: Content,
): boolean {
  if (tiles[tile.slot] !== undefined || tiles.object !== undefined) {
    return false;
  }
  const ground = tiles.ground === undefined ? undefined : content.tiles.get(tiles.ground);
  return ground !== undefined && !ground.solid;
}

/** Whether the square box of a character (half size `half`, centered on its feet) overlaps tile (x, y). */
export function boxOverlapsTile(feet: TilePoint, half: number, x: number, y: number): boolean {
  return (
    feet.x + half - EDGE_EPSILON > x &&
    feet.x - half + EDGE_EPSILON < x + 1 &&
    feet.y + half - EDGE_EPSILON > y &&
    feet.y - half + EDGE_EPSILON < y + 1
  );
}

/**
 * Places the item in hand (an item with `place`) on a free tile in reach, outside the safe zone (except
 * for an admin); a solid one never on the player. Performed by the building module, which also checks
 * that no other character stands there.
 */
export const placeAction: ActionDef = {
  id: 'place',
  targets: ['tile'],
  priority: INTERACTION.priorities.place,
  labelKey: 'ui.actions.place',
  use: true,
  effort: true,
  appliesTo: (subject, content, actor) =>
    subject.kind === 'tile' && heldPlaceable(actor, content) !== undefined,
  canPerform: ({ actor, subject, content, safeZone }) => {
    const tile = heldPlaceable(actor, content);
    if (subject.kind !== 'tile' || !tile) {
      return { ok: false, reason: 'unavailable' };
    }
    if (safeZone && !actor.admin && inSafeZone(safeZone, actor.layer, subject.x, subject.y)) {
      return { ok: false, reason: 'safeZone' };
    }
    const onActor =
      tile.solid && boxOverlapsTile(actor, PLAYER.hitboxSizeTiles / 2, subject.x, subject.y);
    if (!hasRoomFor(subject.tiles, tile, content) || onActor) {
      return { ok: false, reason: 'occupied' };
    }
    return { ok: true };
  },
};

/** Whether the door on the aimed tile is open; undefined when there is no door. */
function aimedDoorOpen(subject: ActionSubject, content: Content): boolean | undefined {
  const target = tileTarget(subject, content);
  if (subject.kind !== 'tile' || target?.tile.door !== true) {
    return undefined;
  }
  return isDoorOpen(subject.meta);
}

/** Opens a closed door: it no longer blocks. Performed by the building module. */
export const openDoorAction: ActionDef = {
  id: 'openDoor',
  targets: ['tile'],
  priority: INTERACTION.priorities.openDoor,
  labelKey: 'ui.actions.openDoor',
  appliesTo: (subject, content) => aimedDoorOpen(subject, content) === false,
  canPerform: () => ({ ok: true }),
};

/**
 * Closes an open door: it blocks again. Not on someone standing in the doorway (the building module
 * also checks the other characters).
 */
export const closeDoorAction: ActionDef = {
  id: 'closeDoor',
  targets: ['tile'],
  priority: INTERACTION.priorities.closeDoor,
  labelKey: 'ui.actions.closeDoor',
  appliesTo: (subject, content) => aimedDoorOpen(subject, content) === true,
  canPerform: ({ actor, subject }) =>
    subject.kind === 'tile' &&
    boxOverlapsTile(actor, PLAYER.hitboxSizeTiles / 2, subject.x, subject.y)
      ? { ok: false, reason: 'occupied' }
      : { ok: true },
};

/**
 * Sleeps in a bed, for now only to make it the respawn point of the player (used when they die, step
 * 20). Performed by the building module.
 */
export const sleepAction: ActionDef = {
  id: 'sleep',
  targets: ['tile'],
  priority: INTERACTION.priorities.sleep,
  labelKey: 'ui.actions.sleep',
  appliesTo: (subject, content) => tileTarget(subject, content)?.tile.bed === true,
  canPerform: () => ({ ok: true }),
};

/** The building actions: place, then use what was built. */
export const buildingActions: readonly ActionDef[] = [
  placeAction,
  openDoorAction,
  closeDoorAction,
  sleepAction,
];
