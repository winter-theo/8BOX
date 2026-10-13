import {
  type EntityAnim,
  type EntityKind,
  type EntityState,
  type Facing,
  NET,
  type Skin,
} from '@8box/shared';

/** What Phaser draws for an entity seen through snapshots. */
export interface RemoteView {
  id: number;
  kind: EntityKind;
  name: string | undefined;
  /** Players: how they look, once a snapshot told it. */
  skin: Skin | undefined;
  /** Feet position, in tiles. */
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
}

interface Sample {
  /** Local time of the snapshot's tick, in ms. */
  time: number;
  x: number;
  y: number;
  facing: Facing;
  anim: EntityAnim;
}

interface Remote {
  id: number;
  kind: EntityKind;
  name: string | undefined;
  skin: Skin | undefined;
  samples: Sample[];
}

/** Share of the gap closed per snapshot when snapshots come later than the estimate (no unit). */
const OFFSET_RISE = 0.02;

/**
 * The other entities, as snapshots show them. They are drawn `delayMs` in the past, between the two
 * snapshots around that time, so that they move smoothly although snapshots come every tick, with
 * jitter. Snapshot times come from the server tick (evenly spaced), placed on the local clock with an
 * offset that follows the fastest arrivals.
 */
export class RemoteEntities {
  private readonly entities = new Map<number, Remote>();
  /** Local time of tick 0, in ms. */
  private offset: number | undefined;

  constructor(
    /** Duration of a server tick, in ms. */
    private readonly tickMs: number,
    private readonly delayMs: number = NET.interpolationDelayMs,
  ) {}

  get size(): number {
    return this.entities.size;
  }

  /** A snapshot of tick `tick`, received at `now` (ms). */
  update(
    tick: number,
    states: readonly EntityState[],
    gone: readonly number[] = [],
    now = 0,
  ): void {
    const measured = now - tick * this.tickMs;
    this.offset =
      this.offset === undefined || measured < this.offset
        ? measured
        : this.offset + (measured - this.offset) * OFFSET_RISE;
    const time = tick * this.tickMs + this.offset;

    for (const id of gone) {
      this.entities.delete(id);
    }
    for (const state of states) {
      let remote = this.entities.get(state.id);
      if (!remote) {
        remote = {
          id: state.id,
          kind: state.kind,
          name: state.name,
          skin: state.skin,
          samples: [],
        };
        this.entities.set(state.id, remote);
      }
      if (state.name !== undefined) {
        remote.name = state.name;
      }
      if (state.skin !== undefined) {
        remote.skin = state.skin;
      }
      const { x, y, facing, anim } = state;
      remote.samples.push({ time, x, y, facing, anim });
      // Older samples are useless once the next one is already in the drawn past.
      const drawnAt = now - this.delayMs;
      while (remote.samples.length > 2 && (remote.samples[1]?.time ?? Infinity) <= drawnAt) {
        remote.samples.shift();
      }
    }
  }

  /** The entities to draw at `now` (ms). */
  views(now: number): RemoteView[] {
    const drawnAt = now - this.delayMs;
    const views: RemoteView[] = [];
    for (const remote of this.entities.values()) {
      const sample = sampleAt(remote.samples, drawnAt);
      if (sample) {
        views.push({
          id: remote.id,
          kind: remote.kind,
          name: remote.name,
          skin: remote.skin,
          x: sample.x,
          y: sample.y,
          facing: sample.facing,
          moving: sample.anim === 'walk',
        });
      }
    }
    return views;
  }

  clear(): void {
    this.entities.clear();
    this.offset = undefined;
  }
}

/** The state at `time`: between the two samples around it, or the nearest end (no extrapolation). */
function sampleAt(samples: readonly Sample[], time: number): Sample | undefined {
  const first = samples[0];
  if (!first || time <= first.time) {
    return first;
  }
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1] as Sample;
    const after = samples[i] as Sample;
    if (time <= after.time) {
      const t = (time - before.time) / (after.time - before.time || 1);
      return {
        ...before,
        x: before.x + (after.x - before.x) * t,
        y: before.y + (after.y - before.y) * t,
      };
    }
  }
  return samples.at(-1);
}
