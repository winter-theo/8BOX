import { INTERACTION } from '../config/interaction';
import { addItems } from '../inventory/inventory';
import { type ActionDef, tileThing } from './actions';
import { harvestActions } from './harvest';

/** Takes a pile of items lying on the ground (as much of it as fits). Performed by the inventory module. */
export const pickUpAction: ActionDef = {
  id: 'pickUp',
  targets: ['entity'],
  priority: INTERACTION.priorities.pickUp,
  labelKey: 'ui.actions.pickUp',
  appliesTo: (subject) =>
    subject.kind === 'entity' && subject.entity === 'groundItem' && subject.item !== undefined,
  canPerform: ({ actor, subject, content }) => {
    if (subject.kind !== 'entity' || subject.item === undefined) {
      return { ok: false, reason: 'unavailable' };
    }
    // Room for one item is enough: the rest of the pile stays on the ground.
    const added = addItems(actor.inventory, content.items, { item: subject.item, count: 1 });
    return added.left === 0 ? { ok: true } : { ok: false, reason: 'inventoryFull' };
  },
};

/** Tells the name of what the player aims at. Performed by the interaction module. */
export const examineAction: ActionDef = {
  id: 'examine',
  targets: ['tile', 'entity'],
  priority: INTERACTION.priorities.examine,
  labelKey: 'ui.actions.examine',
  appliesTo: (subject) => subject.kind !== 'tile' || tileThing(subject.tiles) !== undefined,
  canPerform: () => ({ ok: true }),
};

/** The actions of the base game. The steps that bring new actions add them here. */
export const baseActions: readonly ActionDef[] = [pickUpAction, examineAction, ...harvestActions];
