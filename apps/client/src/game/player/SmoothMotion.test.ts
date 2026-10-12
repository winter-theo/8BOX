import { describe, expect, it } from 'vitest';
import { SmoothMotion } from './SmoothMotion';

const STEP_MS = 50;
const SNAP = 2;
const SMOOTHING_MS = 80;

function motion() {
  return new SmoothMotion({ x: 0, y: 0 }, STEP_MS, SNAP, SMOOTHING_MS);
}

describe('SmoothMotion', () => {
  it('glides from the previous step to the new one over one step', () => {
    const smooth = motion();
    smooth.step({ x: 1, y: 0 }, 1000);

    expect(smooth.position(1000).x).toBeCloseTo(0);
    expect(smooth.position(1025).x).toBeCloseTo(0.5);
    expect(smooth.position(1050).x).toBeCloseTo(1);
    expect(smooth.position(2000).x).toBeCloseTo(1);
  });

  it('starts the next glide where the drawing is, without a jump', () => {
    const smooth = motion();
    smooth.step({ x: 1, y: 0 }, 1000);
    const drawn = smooth.position(1040).x;

    smooth.step({ x: 2, y: 0 }, 1040);

    expect(smooth.position(1040).x).toBeCloseTo(drawn);
    expect(smooth.position(1090).x).toBeCloseTo(2);
  });

  it('turns a small correction into an offset that fades out', () => {
    const smooth = motion();
    smooth.step({ x: 1, y: 0 }, 1000);
    const drawn = smooth.position(1060).x;

    smooth.correct({ x: 0.8, y: 0 }, 1060);

    expect(smooth.position(1060).x).toBeCloseTo(drawn); // No jump.
    expect(smooth.position(1060 + 10 * SMOOTHING_MS).x).toBeCloseTo(0.8);
  });

  it('applies a big correction at once', () => {
    const smooth = motion();
    smooth.step({ x: 1, y: 0 }, 1000);

    smooth.correct({ x: 1, y: 5 }, 1060);

    expect(smooth.position(1060)).toEqual({ x: 1, y: 5 });
  });
});
