/**
 * The world clock: ms of world time since the world was created. The time module advances it every
 * tick, `scale` times as fast as real time (1, or more in dev with `TIME_SCALE`).
 */
export class WorldClock {
  constructor(
    public timeMs = 0,
    readonly scale = 1,
  ) {}

  /** Moves the clock on by `realMs` ms of real time. */
  advance(realMs: number): void {
    this.timeMs += realMs * this.scale;
  }
}
