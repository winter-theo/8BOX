import { describe, expect, it } from 'vitest';
import { creatureLift } from './Monsters';

const view = { creatureHopPx: 2, creatureBobPx: 1, walkFrameMs: 150 };

describe('creatureLift', () => {
  it('keeps a still creature on the ground', () => {
    expect(creatureLift({ moveMs: 400, restMs: 200 }, false, 200, view)).toBe(0);
    expect(creatureLift(undefined, false, 200, view)).toBe(0);
  });

  it('makes a hopping creature rise and land again during each hop', () => {
    const hop = { moveMs: 400, restMs: 200 };
    expect(creatureLift(hop, true, 0, view)).toBe(0);
    expect(creatureLift(hop, true, 200, view)).toBe(2);
    expect(creatureLift(hop, true, 399, view)).toBe(0);
  });

  it('makes a walking creature bob by one pixel, frame after frame', () => {
    expect(creatureLift(undefined, true, 0, view)).toBe(0);
    expect(creatureLift(undefined, true, 150, view)).toBe(1);
    expect(creatureLift(undefined, true, 300, view)).toBe(0);
  });
});
