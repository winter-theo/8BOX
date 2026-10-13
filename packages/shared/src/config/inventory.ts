import { MINUTE_MS, SECOND_MS } from './units';

export const INVENTORY = {
  /** Slots of a character inventory without a bag, in slots (a bag adds its own `extraSlots`). */
  mainSlots: 10,
  /** Most slots an inventory can have, bag included, in slots (bounds bags and messages). */
  maxSlots: 30,
  /** Equipment slots of a character. */
  equipmentSlots: ['head', 'body', 'bag'],
  /** Item kept in the purse instead of the slots; the purse holds up to its stack size. */
  currencyItem: 'base:gold',
  /** Stack size of an item whose content does not set one, in items. */
  defaultStackSize: 99,
  /** Stack size of tools and weapons when their content does not set one, in items. */
  toolStackSize: 1,
  /** Time before an item lying on the ground disappears, in ms (10 min). */
  groundItemLifetimeMs: 10 * MINUTE_MS,
  /** Time before the player who dropped an item can pick it back up, in ms. */
  dropPickupDelayMs: 2 * SECOND_MS,
  /** A player picks up the items lying this close to their feet, in tiles. */
  pickupRadiusTiles: 0.5,
  /** A dropped item lands this far in front of the player (at their feet if that tile is solid), in tiles. */
  dropDistanceTiles: 1,
  /** A dropped item joins a pile of the same item lying this close, in tiles. */
  groundMergeRadiusTiles: 1,
  /** Interval of the removal of the items lying on the ground for too long, in ms. */
  groundItemExpiryCheckMs: SECOND_MS,
} as const;
