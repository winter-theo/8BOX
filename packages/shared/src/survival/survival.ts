import type { GameConfig } from '../config';
import { SURVIVAL } from '../config/survival';

export type SurvivalConfig = GameConfig['survival'];

/** Health and hunger of a character, with the time gathered toward their next changes. */
export interface Vitals {
  /** In HP, from 0 (dead) to `maxHealth`. */
  health: number;
  /** In hunger points, from 0 (starving) to `maxHunger`. */
  hunger: number;
  /** Time (and fatigue) gathered toward the next hunger loss, in ms. */
  hungerMs: number;
  /** Time spent starving toward the next starvation damage, in ms. */
  starvationMs: number;
  /** Time spent well fed toward the next HP regenerated, in ms. */
  regenMs: number;
}

/** Vitals with no time gathered yet. */
export function freshVitals(health: number, hunger: number): Vitals {
  return { health, hunger, hungerMs: 0, starvationMs: 0, regenMs: 0 };
}

/**
 * Advances the vitals by `dtMs`. Hunger drops by 1 every `hungerDecayIntervalMs` (sooner with fatigue,
 * see `addFatigue`). At 0 hunger the character starves: 1 HP every `starvationDamageIntervalMs`,
 * returned as `starvation` for the damage function (which knows invulnerability and death). At
 * `regenMinHunger` or more, it heals 1 HP every `regenIntervalMs`. The timers of starvation and healing
 * start again from 0 each time they stop.
 */
export function stepVitals(
  vitals: Vitals,
  dtMs: number,
  config: SurvivalConfig = SURVIVAL,
): { vitals: Vitals; starvation: number } {
  let { health, hunger, hungerMs, starvationMs, regenMs } = vitals;
  hungerMs += dtMs;
  while (hungerMs >= config.hungerDecayIntervalMs) {
    hungerMs -= config.hungerDecayIntervalMs;
    hunger = Math.max(0, hunger - 1);
  }
  let starvation = 0;
  if (hunger === 0) {
    starvationMs += dtMs;
    while (starvationMs >= config.starvationDamageIntervalMs) {
      starvationMs -= config.starvationDamageIntervalMs;
      starvation += 1;
    }
  } else {
    starvationMs = 0;
  }
  if (hunger >= config.regenMinHunger && health > 0 && health < config.maxHealth) {
    regenMs += dtMs;
    while (regenMs >= config.regenIntervalMs && health < config.maxHealth) {
      regenMs -= config.regenIntervalMs;
      health += 1;
    }
  } else {
    regenMs = 0;
  }
  return { vitals: { health, hunger, hungerMs, starvationMs, regenMs }, starvation };
}

/** An action that takes effort brings the next hunger loss closer by `fatigueMs`. */
export function addFatigue<T extends Pick<Vitals, 'hungerMs'>>(vitals: T, fatigueMs: number): T {
  return { ...vitals, hungerMs: vitals.hungerMs + fatigueMs };
}

/** Hunger after eating food that restores `food` hunger points (the stomach holds `maxHunger` at most). */
export function eatFood(hunger: number, food: number, config: SurvivalConfig = SURVIVAL): number {
  return Math.min(config.maxHunger, hunger + food);
}

/** Gold dropped on death out of a purse of `purse` coins: a share of it, rounded down. */
export function deathGoldLoss(purse: number, config: SurvivalConfig = SURVIVAL): number {
  return Math.floor(purse * config.deathGoldDropFraction);
}
