export const PLAYER = {
  /** Walking speed, in tiles per second. */
  speedTilesPerSecond: 5,
  /** Side of the square collision box of a player, in tiles. */
  hitboxSizeTiles: 0.6,
  /** Shortest player name, in characters. */
  nameMinLength: 3,
  /** Longest player name, in characters. */
  nameMaxLength: 16,
  /** Characters allowed in a player name: ASCII letters, digits and underscore. */
  namePattern: /^[A-Za-z0-9_]+$/,
  /** Skins a player can pick (the client has their art); the first one is given to new players. */
  skins: ['default', 'cat', 'hat'],
} as const;

export type Skin = (typeof PLAYER.skins)[number];

export const DEFAULT_SKIN: Skin = PLAYER.skins[0];

export function isSkin(value: string): value is Skin {
  return (PLAYER.skins as readonly string[]).includes(value);
}
