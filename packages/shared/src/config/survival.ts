import { SECOND_MS } from './units';

export const SURVIVAL = {
  /** Maximum health, in HP. */
  maxHealth: 20,
  /** Maximum hunger (full stomach), in hunger points. */
  maxHunger: 20,
  /** Time between two losses of 1 hunger point, in ms. */
  hungerDecayIntervalMs: 90 * SECOND_MS,
  /** While hunger is 0: time between two losses of 1 HP, in ms. */
  starvationDamageIntervalMs: 10 * SECOND_MS,
  /** Time between two gains of 1 HP while hunger is high enough, in ms. */
  regenIntervalMs: 5 * SECOND_MS,
  /** Hunger needed to regenerate health, in hunger points. */
  regenMinHunger: 16,
  /** Share of the carried gold dropped on death, from 0 to 1. */
  deathGoldDropFraction: 0.1,
  /** Invulnerability after respawning, in ms. */
  respawnInvulnerabilityMs: 5 * SECOND_MS,
} as const;
