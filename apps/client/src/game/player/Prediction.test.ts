import {
  directionOf,
  type MovementWorld,
  type MoverState,
  PLAYER,
  stepMovement,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { Prediction } from './Prediction';

const DT = 0.05;
const STEP = PLAYER.speedTilesPerSecond * DT;
const RIGHT = directionOf(1, 0);
const DOWN = directionOf(0, 1);
const OPEN: MovementWorld = { isSolid: () => false, speedFactor: () => 1 };
const start = { x: 10.5, y: 10.5, facing: 'down' as const };

function predictInputs(count: number, dir = RIGHT) {
  const prediction = new Prediction(start, DT);
  for (let seq = 0; seq < count; seq++) {
    prediction.apply({ seq, dir }, OPEN);
  }
  return prediction;
}

describe('Prediction', () => {
  it('applies each input at once', () => {
    const prediction = predictInputs(4);
    expect(prediction.state.x).toBeCloseTo(start.x + 4 * STEP);
    expect(prediction.state.facing).toBe('right');
    expect(prediction.pendingCount).toBe(4);
  });

  it('keeps the same position when the server agrees', () => {
    const prediction = predictInputs(5);
    const before = prediction.state;
    // The server applied inputs 0 to 2, exactly as predicted.
    const server = { x: start.x + 3 * STEP, y: start.y, facing: 'right' as const };

    prediction.reconcile(2, server, OPEN);

    expect(prediction.state.x).toBeCloseTo(before.x);
    expect(prediction.pendingCount).toBe(2);
  });

  it('replays the pending inputs from a corrected server position', () => {
    const prediction = new Prediction(start, DT);
    prediction.apply({ seq: 0, dir: RIGHT }, OPEN);
    prediction.apply({ seq: 1, dir: RIGHT }, OPEN);
    prediction.apply({ seq: 2, dir: DOWN }, OPEN);
    prediction.apply({ seq: 3, dir: DOWN }, OPEN);
    // The server stopped the player after input 1 (a wall the client did not know about).
    const server = { x: start.x + 0.1, y: start.y, facing: 'right' as const };

    const state = prediction.reconcile(1, server, OPEN);

    let expected: MoverState = server;
    expected = stepMovement(expected, { dir: DOWN }, DT, OPEN);
    expected = stepMovement(expected, { dir: DOWN }, DT, OPEN);
    expect(state).toEqual(expected);
    expect(state.x).toBeCloseTo(start.x + 0.1);
    expect(state.y).toBeCloseTo(start.y + 2 * STEP);
    expect(state.facing).toBe('down');
  });

  it('collides while replaying, with the world it knows', () => {
    const prediction = predictInputs(8); // 2 tiles to the right, through column 12
    // A wall now known on column 12, after the server's answer.
    const wall: MovementWorld = { isSolid: (x) => x === 12, speedFactor: () => 1 };

    const state = prediction.reconcile(-1, start, wall);

    expect(state.x).toBeCloseTo(12 - PLAYER.hitboxSizeTiles / 2);
  });

  it('forgets every acknowledged input', () => {
    const prediction = predictInputs(3);
    prediction.reconcile(2, { ...start, x: start.x + 3 * STEP }, OPEN);
    expect(prediction.pendingCount).toBe(0);
    expect(prediction.state.x).toBeCloseTo(start.x + 3 * STEP);
  });
});
