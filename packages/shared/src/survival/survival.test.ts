import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config/survival';
import {
  addFatigue,
  deathGoldLoss,
  eatFood,
  freshVitals,
  stepVitals,
  type Vitals,
} from './survival';

const SECOND = 1000;

/** Advances the vitals tick by tick (50 ms) for `ms`, adding up the starvation damage. */
function run(vitals: Vitals, ms: number): { vitals: Vitals; starvation: number } {
  let state = vitals;
  let starvation = 0;
  for (let t = 0; t < ms; t += 50) {
    const step = stepVitals(state, 50);
    state = step.vitals;
    starvation += step.starvation;
  }
  return { vitals: state, starvation };
}

describe('survival', () => {
  it('loses one hunger point every 90 s', () => {
    const start = freshVitals(20, 20);
    expect(run(start, 89 * SECOND).vitals.hunger).toBe(20);
    expect(run(start, 90 * SECOND).vitals.hunger).toBe(19);
    expect(run(start, 3 * 90 * SECOND).vitals.hunger).toBe(17);
  });

  it('gets hungry sooner with the fatigue of actions', () => {
    // 30 actions of 3 s bring a hunger loss forward by 90 s: it is lost at once.
    let tired = freshVitals(20, 20);
    for (let i = 0; i < 30; i++) {
      tired = addFatigue(tired, SURVIVAL.actionFatigueMs);
    }
    expect(stepVitals(tired, 50).vitals.hunger).toBe(19);
    expect(run(addFatigue(freshVitals(20, 20), 60 * SECOND), 30 * SECOND).vitals.hunger).toBe(19);
  });

  it('starves at 0 hunger: 1 HP every 10 s, never below 0 hunger', () => {
    const starving = freshVitals(20, 0);
    expect(run(starving, 9 * SECOND).starvation).toBe(0);
    expect(run(starving, 10 * SECOND).starvation).toBe(1);
    const minute = run(starving, 60 * SECOND);
    expect(minute.starvation).toBe(6);
    expect(minute.vitals.hunger).toBe(0);
    // Starvation starts counting again after eating.
    const before = run(starving, 9 * SECOND).vitals;
    const fed = run({ ...before, hunger: eatFood(before.hunger, 2) }, 2 * SECOND);
    expect(fed.starvation).toBe(0);
    expect(fed.vitals.starvationMs).toBe(0);
  });

  it('heals 1 HP every 5 s while hunger is 16 or more', () => {
    expect(run(freshVitals(10, 16), 5 * SECOND).vitals.health).toBe(11);
    expect(run(freshVitals(10, 20), 25 * SECOND).vitals.health).toBe(15);
    expect(run(freshVitals(10, 15), 60 * SECOND).vitals.health).toBe(10);
    expect(run(freshVitals(19, 20), 60 * SECOND).vitals.health).toBe(20);
    // Hunger dropping below 16 stops the healing.
    const hungry = run({ ...freshVitals(10, 16), hungerMs: 88 * SECOND }, 10 * SECOND).vitals;
    expect(hungry.hunger).toBe(15);
    expect(hungry.health).toBe(10);
  });

  it('eating adds the hunger of the food, up to a full stomach', () => {
    expect(eatFood(10, 2)).toBe(12);
    expect(eatFood(10, 4)).toBe(14);
    expect(eatFood(18, 4)).toBe(20);
  });

  it('drops 10 % of the gold on death, rounded down', () => {
    expect(deathGoldLoss(0)).toBe(0);
    expect(deathGoldLoss(9)).toBe(0);
    expect(deathGoldLoss(10)).toBe(1);
    expect(deathGoldLoss(255)).toBe(25);
    expect(deathGoldLoss(1_000_000)).toBe(100_000);
  });
});
