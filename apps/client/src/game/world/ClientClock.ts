import { TIME } from '@8box/shared';

/**
 * The world clock as the server last sent it, run locally between two sendings at its scale. When a
 * new sending differs from the running clock, the gap fades out over `smoothingMs` instead of jumping.
 */
export class ClientClock {
  private base: { worldTimeMs: number; scale: number; atMs: number } | undefined;
  /** Running clock minus the last sending, when it came; faded out over `smoothingMs`. */
  private gap = { ms: 0, atMs: 0 };

  constructor(private readonly smoothingMs: number = TIME.syncSmoothingMs) {}

  /** A sending of the server (`time`), received at `nowMs` (local clock). */
  sync(worldTimeMs: number, scale: number, nowMs: number): void {
    const running = this.timeAt(nowMs);
    this.base = { worldTimeMs, scale, atMs: nowMs };
    this.gap = { ms: running === undefined ? 0 : running - worldTimeMs, atMs: nowMs };
  }

  /** World time at `nowMs` (local clock); undefined before the first sending. */
  timeAt(nowMs: number): number | undefined {
    if (!this.base) {
      return undefined;
    }
    const run = this.base.worldTimeMs + (nowMs - this.base.atMs) * this.base.scale;
    const left =
      this.smoothingMs > 0 ? Math.max(0, 1 - (nowMs - this.gap.atMs) / this.smoothingMs) : 0;
    return run + this.gap.ms * left;
  }

  clear(): void {
    this.base = undefined;
    this.gap = { ms: 0, atMs: 0 };
  }
}
