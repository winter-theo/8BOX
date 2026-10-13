import type { EntityState } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { RemoteEntities } from './RemoteEntities';

const TICK_MS = 50;
const DELAY_MS = 100;

const bob = (x: number, extra: Partial<EntityState> = {}): EntityState => ({
  id: 7,
  kind: 'player',
  x,
  y: 10,
  facing: 'right',
  anim: 'walk',
  ...extra,
});

/** Bob walking right one tile per tick, snapshots of ticks 0 to `last` arriving `latency` ms late. */
function walking(last: number, latency = 30) {
  const remotes = new RemoteEntities(TICK_MS, DELAY_MS);
  for (let tick = 0; tick <= last; tick++) {
    remotes.update(
      tick,
      [bob(tick, tick === 0 ? { name: 'Bob' } : {})],
      [],
      tick * TICK_MS + latency,
    );
  }
  return remotes;
}

describe('RemoteEntities', () => {
  it('draws an entity in the past, between the two snapshots around that time', () => {
    const remotes = walking(10);
    // Tick n arrived at n × 50 + 30 ms: 100 ms before 555 ms is 455 ms, halfway from tick 8 to 9.
    const [view] = remotes.views(10 * TICK_MS + 30 + 25);
    expect(view?.x).toBeCloseTo(8.5);
    expect(view).toMatchObject({
      id: 7,
      kind: 'player',
      name: 'Bob',
      facing: 'right',
      moving: true,
    });
  });

  it('keeps the skin of a player until a snapshot changes it', () => {
    const remotes = new RemoteEntities(TICK_MS, DELAY_MS);
    remotes.update(0, [bob(0, { name: 'Bob', skin: 'cat' })], [], 0);
    remotes.update(1, [bob(1)], [], TICK_MS);
    expect(remotes.views(TICK_MS)[0]?.skin).toBe('cat');

    remotes.update(2, [bob(2, { skin: 'hat' })], [], 2 * TICK_MS);
    expect(remotes.views(2 * TICK_MS)[0]?.skin).toBe('hat');
  });

  it('moves evenly although snapshots arrive with jitter', () => {
    const remotes = new RemoteEntities(TICK_MS, DELAY_MS);
    const jitter = [0, 25, 5, 40, 10, 0, 30, 15, 20, 5, 35];
    jitter.forEach((late, tick) => {
      remotes.update(tick, [bob(tick)], [], tick * TICK_MS + 30 + late);
    });
    const now = 10 * TICK_MS + 30 + 35;
    const a = remotes.views(now)[0]?.x ?? NaN;
    const b = remotes.views(now + 20)[0]?.x ?? NaN;
    expect(b - a).toBeCloseTo(20 / TICK_MS); // One tile per 50 ms, whatever the jitter.
  });

  it('shows a new entity where it appeared, and does not extrapolate', () => {
    const remotes = new RemoteEntities(TICK_MS, DELAY_MS);
    remotes.update(3, [bob(3, { name: 'Bob' })], [], 200);
    expect(remotes.views(200)[0]?.x).toBe(3);

    remotes.update(4, [bob(4)], [], 250);
    expect(remotes.views(10_000)[0]).toMatchObject({ x: 4, name: 'Bob' });
  });

  it('forgets the entities that are gone', () => {
    const remotes = walking(3);
    remotes.update(4, [], [7], 4 * TICK_MS + 30);
    expect(remotes.views(1000)).toEqual([]);
    expect(remotes.size).toBe(0);
  });

  it('keeps few samples per entity', () => {
    const remotes = walking(200);
    remotes.views(200 * TICK_MS);
    const samples = (
      remotes as unknown as { entities: Map<number, { samples: unknown[] }> }
    ).entities.get(7)?.samples.length;
    expect(samples).toBeLessThanOrEqual(DELAY_MS / TICK_MS + 2);
  });
});
