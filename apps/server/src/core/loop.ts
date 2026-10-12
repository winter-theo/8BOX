export interface TickStats {
  /** Ticks run since the start. */
  ticks: number;
  /** Mean duration of the recent ticks, in ms. */
  avgMs: number;
  /** Longest of the recent ticks, in ms. */
  maxMs: number;
  /** Ticks dropped because the server fell too far behind. */
  skippedTicks: number;
}

export interface GameLoopOptions {
  /** Fixed duration of a tick, in ms. */
  tickMs: number;
  /** Max ticks run in a row to catch up; older lag is dropped. */
  maxCatchUpTicks: number;
  /** Ticks kept for the statistics. */
  statsWindowTicks: number;
  /** Runs one tick. `tick` starts at 1. */
  onTick: (tick: number) => void;
  /** Called when a tick throws; the loop keeps running. */
  onError: (error: unknown, tick: number) => void;
  /** Clock deciding when ticks are due, in ms (default: performance.now). */
  now?: () => number;
  /** Clock measuring tick durations, in ms (default: performance.now). */
  measure?: () => number;
}

/**
 * Fixed-step game loop: ticks always advance the game by `tickMs`. When the process is late it runs
 * up to `maxCatchUpTicks` ticks in a row, then drops the rest of the lag instead of spiraling.
 */
export class GameLoop {
  private readonly options: Required<GameLoopOptions>;
  private readonly durations: number[] = [];
  private lastTime: number | undefined;
  private accumulatorMs = 0;
  private tickCount = 0;
  private skipped = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: GameLoopOptions) {
    this.options = {
      now: () => performance.now(),
      measure: () => performance.now(),
      ...options,
    };
  }

  get running(): boolean {
    return this.timer !== undefined;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.lastTime = this.options.now();
    const wake = () => {
      this.update(this.options.now());
      this.timer = setTimeout(wake, Math.max(0, this.options.tickMs - this.accumulatorMs));
    };
    this.timer = setTimeout(wake, this.options.tickMs);
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.lastTime = undefined;
    this.accumulatorMs = 0;
  }

  /** Runs the ticks that are due at time `now` (ms). Returns how many ran. */
  update(now: number): number {
    if (this.lastTime === undefined) {
      this.lastTime = now;
      return 0;
    }
    const { tickMs, maxCatchUpTicks } = this.options;
    this.accumulatorMs += Math.max(0, now - this.lastTime);
    this.lastTime = now;

    let ran = 0;
    while (this.accumulatorMs >= tickMs && ran < maxCatchUpTicks) {
      this.runTick();
      this.accumulatorMs -= tickMs;
      ran++;
    }
    if (this.accumulatorMs >= tickMs) {
      const dropped = Math.floor(this.accumulatorMs / tickMs);
      this.skipped += dropped;
      this.accumulatorMs -= dropped * tickMs;
    }
    return ran;
  }

  stats(): TickStats {
    const count = this.durations.length;
    const total = this.durations.reduce((sum, duration) => sum + duration, 0);
    return {
      ticks: this.tickCount,
      avgMs: count === 0 ? 0 : total / count,
      maxMs: count === 0 ? 0 : Math.max(...this.durations),
      skippedTicks: this.skipped,
    };
  }

  private runTick(): void {
    this.tickCount++;
    const start = this.options.measure();
    try {
      this.options.onTick(this.tickCount);
    } catch (error) {
      this.options.onError(error, this.tickCount);
    }
    this.durations.push(this.options.measure() - start);
    if (this.durations.length > this.options.statsWindowTicks) {
      this.durations.shift();
    }
  }
}
