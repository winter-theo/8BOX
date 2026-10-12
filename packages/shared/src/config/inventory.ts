import { MINUTE_MS, SECOND_MS } from './units';

export const INVENTORY = {
  /** Slots of a character inventory without a bag, in slots (a bag adds its own `extraSlots`). */
  mainSlots: 10,
  /** Equipment slots of a character. */
  equipmentSlots: ['head', 'body', 'bag'],
  /** Stack size of an item whose content does not set one, in items. */
  defaultStackSize: 99,
  /** Stack size of tools and weapons when their content does not set one, in items. */
  toolStackSize: 1,
  /** Time before an item lying on the ground disappears, in ms (10 min). */
  groundItemLifetimeMs: 10 * MINUTE_MS,
  /** Time before the player who dropped an item can pick it back up, in ms. */
  dropPickupDelayMs: 2 * SECOND_MS,
} as const;
