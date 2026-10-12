export const PLAYER = {
  /** Walking speed, in tiles per second. */
  speedTilesPerSecond: 5,
  /** Speed multiplier in shallow water (no unit). */
  shallowWaterSpeedFactor: 0.5,
  /** Side of the square collision box of a player, in tiles. */
  hitboxSizeTiles: 0.6,
  /** Shortest player name, in characters. */
  nameMinLength: 3,
  /** Longest player name, in characters. */
  nameMaxLength: 16,
  /** Characters allowed in a player name: ASCII letters, digits and underscore. */
  namePattern: /^[A-Za-z0-9_]+$/,
} as const;
