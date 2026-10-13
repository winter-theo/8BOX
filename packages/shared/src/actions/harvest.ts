import { HARVEST } from '../config/harvest';
import { INTERACTION } from '../config/interaction';
import type { Content } from '../content/load';
import type { HarvestAction, TileDef, TileSlot } from '../content/schemas';
import { inSafeZone } from '../world/safeZone';
import {
  type ActionCheck,
  type ActionContext,
  type ActionDef,
  type ActionSubject,
  thingSlot,
} from './actions';

/** The tile an action on a tile works on: the thing that names it (object, floor or ground). */
export function tileTarget(
  subject: ActionSubject,
  content: Content,
): { slot: TileSlot; tile: TileDef } | undefined {
  if (subject.kind !== 'tile') {
    return undefined;
  }
  const slot = thingSlot(subject.tiles);
  const id = slot && subject.tiles[slot];
  const tile = id === undefined ? undefined : content.tiles.get(id);
  return slot && tile ? { slot, tile } : undefined;
}

/** Nothing is broken in the safe zone, except by an admin. */
function notInSafeZone({ actor, subject, safeZone }: ActionContext): ActionCheck {
  if (
    subject.kind === 'tile' &&
    safeZone &&
    !actor.admin &&
    inSafeZone(safeZone, actor.layer, subject.x, subject.y)
  ) {
    return { ok: false, reason: 'safeZone' };
  }
  return { ok: true };
}

/**
 * One hit on a tile broken that way (`harvest.action` of the tile): it takes HP depending on the item
 * in hand, and breaks the tile at 0 (its loot goes to the player). Performed by the harvest module.
 */
function hitAction(id: HarvestAction): ActionDef {
  return {
    id,
    targets: ['tile'],
    priority: INTERACTION.priorities[id],
    labelKey: `ui.actions.${id}`,
    use: true,
    effort: true,
    appliesTo: (subject, content) => tileTarget(subject, content)?.tile.harvest?.action === id,
    canPerform: notInSafeZone,
  };
}

/** Cuts a tree, hit after hit. */
export const cutAction = hitAction('cut');
/** Uproots tall grass (and flowers). */
export const uprootAction = hitAction('uproot');
/** Breaks a placed object (step 18). */
export const breakAction = hitAction('break');

/**
 * Picks a berry bush: its loot goes to the player and it becomes picked, until it grows back. It breaks
 * nothing, so it is allowed in the safe zone. Performed by the harvest module.
 */
export const pickAction: ActionDef = {
  id: 'pick',
  targets: ['tile'],
  priority: INTERACTION.priorities.pick,
  durationMs: HARVEST.pickDurationMs,
  labelKey: 'ui.actions.pick',
  use: true,
  effort: true,
  appliesTo: (subject, content) => tileTarget(subject, content)?.tile.pick !== undefined,
  canPerform: () => ({ ok: true }),
};

/** The harvest actions. */
export const harvestActions: readonly ActionDef[] = [
  cutAction,
  uprootAction,
  pickAction,
  breakAction,
];
