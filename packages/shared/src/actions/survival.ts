import { INTERACTION } from '../config/interaction';
import { SURVIVAL } from '../config/survival';
import type { Content } from '../content/load';
import { heldStack, type Inventory } from '../inventory/inventory';
import type { ActionDef } from './actions';

/** The item in hand when it is food, with the hunger points it restores. */
export function heldFood(
  inventory: Inventory,
  content: Content,
): { item: string; hunger: number } | undefined {
  const held = heldStack(inventory);
  const food = held ? content.items.get(held.item)?.food : undefined;
  return held && food ? { item: held.item, hunger: food.hunger } : undefined;
}

/**
 * Eats one of the food in hand (an item with `food`), unless the stomach is full. Aimed at oneself;
 * "use the item in hand" tries it first. Performed by the survival module.
 */
export const eatAction: ActionDef = {
  id: 'eat',
  targets: ['self'],
  priority: INTERACTION.priorities.eat,
  labelKey: 'ui.actions.eat',
  use: true,
  appliesTo: (_subject, content, actor) => heldFood(actor.inventory, content) !== undefined,
  canPerform: ({ actor }) =>
    actor.hunger !== undefined && actor.hunger >= SURVIVAL.maxHunger
      ? { ok: false, reason: 'full' }
      : { ok: true },
};

/** The survival actions. */
export const survivalActions: readonly ActionDef[] = [eatAction];
