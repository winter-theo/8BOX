export const COMBAT = {
  /** Damage of a bare-handed hit, in HP. */
  unarmedDamage: 1,
  /** Time between two bare-handed hits, in ms. */
  unarmedCooldownMs: 500,
  /** Distance a hit target is pushed back, in tiles. */
  knockbackTiles: 0.5,
  /** Invulnerability of a target after being hit, in ms. */
  hitInvulnerabilityMs: 500,
} as const;
