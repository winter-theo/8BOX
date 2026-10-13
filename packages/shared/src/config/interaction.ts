export const INTERACTION = {
  /**
   * Max distance between a player's feet and what they act on, in tiles: to the nearest point of the
   * tile (of the tile under the entity, for an entity).
   */
  reachTiles: 1.5,
  /** Shortest time between two actions a player starts; the server refuses faster ones, in ms. */
  actionCooldownMs: 250,
  /**
   * Order of the actions on what the player aims at: the menu lists them by priority (highest first),
   * and the action key (E) does the possible one with the highest priority. No unit.
   */
  priorities: {
    pickUp: 20,
    examine: 0,
  },
  /** Time the result of an action (what was examined, why it was refused) stays on screen, in ms. */
  feedbackMs: 2500,
} as const;
