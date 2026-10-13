import { describe, expect, it } from 'vitest';
import { type RespawnWorld, respawnPoint } from './respawn';

const SPAWN = { layer: 0, x: 32.5, y: 32.5 };
const BED = { layer: 0, x: 10, y: 10 };

/** A world with a bed at (10, 10) (or none), where the listed tiles are blocked. */
function world(bed: boolean, blocked: readonly string[] = []): RespawnWorld {
  return {
    isBed: (layer, x, y) => bed && layer === BED.layer && x === BED.x && y === BED.y,
    isFree: (_layer, x, y) =>
      !(bed && x === BED.x && y === BED.y) && !blocked.includes(`${x},${y}`),
  };
}

describe('respawnPoint', () => {
  it('brings the player back in front of their bed while it exists', () => {
    expect(respawnPoint(BED, world(true), SPAWN)).toEqual({
      position: { layer: 0, x: 10.5, y: 11.5 },
      bedExists: true,
    });
  });

  it('takes another free tile around the bed when the front one is blocked', () => {
    expect(respawnPoint(BED, world(true, ['10,11']), SPAWN).position).toEqual({
      layer: 0,
      x: 9.5,
      y: 10.5,
    });
    const walledIn = ['9,9', '10,9', '11,9', '9,10', '11,10', '9,11', '10,11', '11,11'];
    expect(respawnPoint(BED, world(true, walledIn), SPAWN)).toEqual({
      position: SPAWN,
      bedExists: true,
    });
  });

  it('brings the player back to the spawn when the bed was destroyed, or without a bed', () => {
    expect(respawnPoint(BED, world(false), SPAWN)).toEqual({ position: SPAWN, bedExists: false });
    expect(respawnPoint(undefined, world(true), SPAWN)).toEqual({
      position: SPAWN,
      bedExists: false,
    });
  });
});
