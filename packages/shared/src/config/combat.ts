export const COMBAT = {
  /** Damage of a bare-handed hit, in HP. */
  unarmedDamage: 1,
  /** Time between two bare-handed hits, in ms. */
  unarmedCooldownMs: 500,
  /** How far the hit zone goes in front of the feet of the attacker, in tiles. */
  hitRangeTiles: 1,
  /** Width of the hit zone, across the facing (a little wider than a player), in tiles. */
  hitWidthTiles: 0.8,
  /** Distance a hit target is pushed back, in tiles. */
  knockbackTiles: 0.5,
  /** Invulnerability of a target after being hit, in ms. */
  hitInvulnerabilityMs: 500,
  /**
   * Two players who stopped hitting each other this long start a new fight: the next hit decides who
   * attacked first (`player.killed`), in ms.
   */
  fightMemoryMs: 60_000,
} as const;
