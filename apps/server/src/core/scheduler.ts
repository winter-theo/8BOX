interface Task {
  name: string;
  dueTick: number;
  /** Set for periodic tasks. */
  intervalTicks: number | undefined;
  run: () => void;
  active: boolean;
}

export interface SchedulerOptions {
  /** Duration of a tick, in ms, to convert durations into ticks. */
  tickMs: number;
  /** Called when a task throws; the other tasks still run. */
  onError: (error: unknown, taskName: string) => void;
}

/**
 * Periodic and delayed tasks counted in game ticks, run by the game loop. Game logic uses it instead of
 * `setTimeout`, so time stays deterministic and stops with the loop. Each method returns a cancel function.
 */
export class Scheduler {
  private tasks: Task[] = [];
  private tick = 0;

  constructor(private readonly options: SchedulerOptions) {}

  /** Last tick run. */
  get currentTick(): number {
    return this.tick;
  }

  /** Number of pending tasks. */
  get size(): number {
    return this.tasks.length;
  }

  /** Duration rounded to whole ticks, at least 1. */
  ticksFor(durationMs: number): number {
    return Math.max(1, Math.round(durationMs / this.options.tickMs));
  }

  /** Runs `task` every `intervalMs` (rounded to ticks); the first run is one interval from now. */
  every(intervalMs: number, task: () => void, name = 'periodic task'): () => void {
    return this.everyTicks(this.ticksFor(intervalMs), task, name);
  }

  everyTicks(intervalTicks: number, task: () => void, name = 'periodic task'): () => void {
    return this.add(name, intervalTicks, intervalTicks, task);
  }

  /** Runs `task` once, `delayMs` from now (rounded to ticks, at least the next tick). */
  after(delayMs: number, task: () => void, name = 'delayed task'): () => void {
    return this.inTicks(this.ticksFor(delayMs), task, name);
  }

  /** Runs `task` once, `delayTicks` ticks after the current one. */
  inTicks(delayTicks: number, task: () => void, name = 'delayed task'): () => void {
    return this.add(name, delayTicks, undefined, task);
  }

  /** Runs the tasks due at `tick`, by due tick then creation order. Called once per tick. */
  runTick(tick: number): void {
    this.tick = tick;
    const due = this.tasks
      .filter((task) => task.dueTick <= tick)
      .sort((a, b) => a.dueTick - b.dueTick);
    for (const task of due) {
      // An earlier task of this tick may have cancelled it.
      if (!task.active) {
        continue;
      }
      try {
        task.run();
      } catch (error) {
        this.options.onError(error, task.name);
      }
      if (task.intervalTicks === undefined) {
        task.active = false;
      } else {
        task.dueTick = tick + task.intervalTicks;
      }
    }
    this.tasks = this.tasks.filter((task) => task.active);
  }

  private add(
    name: string,
    delayTicks: number,
    intervalTicks: number | undefined,
    run: () => void,
  ): () => void {
    if (!Number.isInteger(delayTicks) || delayTicks < 1) {
      throw new RangeError(`Task "${name}": delay must be a whole number of ticks ≥ 1`);
    }
    const task: Task = { name, dueTick: this.tick + delayTicks, intervalTicks, run, active: true };
    this.tasks.push(task);
    return () => {
      task.active = false;
    };
  }
}
