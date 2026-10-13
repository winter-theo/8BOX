export const LIGHT = {
  /** Light radius of a source whose content does not set one (e.g. the torch), in tiles. */
  defaultRadiusTiles: 6,
  /** Largest light radius a source may have, in tiles: how far light queries look for sources. */
  maxRadiusTiles: 12,
  /** Ambient light at night, from 0 (black) to 1 (full daylight). */
  nightAmbient: 0.15,
  /**
   * Light level from which a tile counts as lit (no monster appears on it), from 0 to 1. A source
   * gives 1 − (d / radius)² at d tiles: a torch lights up to about 5.4 tiles around it.
   */
  litThreshold: 0.2,
  /** Radius of the faint glow around the local player at night (drawn only, not a light), in tiles. */
  playerGlowRadiusTiles: 3,
  /** Strength of that glow, from 0 (none) to 1 (as bright as a torch). */
  playerGlowStrength: 0.45,
  /** Color of the darkness at night (bluish), 0xRRGGBB. */
  nightTint: 0x0a1030,
  /** Color of the darkness at dawn and dusk (orange), 0xRRGGBB. */
  twilightTint: 0x6a3010,
} as const;
