import { NET } from '@8box/shared';

export interface Point {
  x: number;
  y: number;
}

/**
 * Where to draw the predicted player between two prediction steps (they come every tick, frames come
 * far more often): it glides from the previous step to the last one over one step. A small
 * reconciliation correction does not jump: it becomes an offset that fades out; a big one is applied
 * at once.
 */
export class SmoothMotion {
  private from: Point;
  private to: Point;
  private stepAt = Number.NEGATIVE_INFINITY;
  private offset: Point = { x: 0, y: 0 };
  private offsetAt = 0;

  constructor(
    start: Point,
    /** Time between two prediction steps, in ms. */
    private readonly stepMs: number,
    private readonly snapTiles = NET.predictionSnapTiles,
    private readonly smoothingMs = NET.predictionSmoothingMs,
  ) {
    this.from = { ...start };
    this.to = { ...start };
  }

  /** A new prediction step reached `to` at `now` (ms). */
  step(to: Point, now: number): void {
    this.from = this.glide(now);
    this.to = { ...to };
    this.stepAt = now;
  }

  /** Reconciliation moved the last step to `to` at `now` (ms). */
  correct(to: Point, now: number): void {
    const dx = to.x - this.to.x;
    const dy = to.y - this.to.y;
    if (dx === 0 && dy === 0) {
      return;
    }
    if (Math.hypot(dx, dy) > this.snapTiles) {
      this.from = { ...to };
      this.to = { ...to };
      this.offset = { x: 0, y: 0 };
      return;
    }
    // The whole glide moves with the correction, and an opposite offset keeps the drawing in place.
    const offset = this.offsetNow(now);
    this.from = { x: this.from.x + dx, y: this.from.y + dy };
    this.to = { ...to };
    this.offset = { x: offset.x - dx, y: offset.y - dy };
    this.offsetAt = now;
  }

  /** Position to draw at `now` (ms). */
  position(now: number): Point {
    const base = this.glide(now);
    const offset = this.offsetNow(now);
    return { x: base.x + offset.x, y: base.y + offset.y };
  }

  private glide(now: number): Point {
    const t = Math.min(1, Math.max(0, (now - this.stepAt) / this.stepMs));
    return {
      x: this.from.x + (this.to.x - this.from.x) * t,
      y: this.from.y + (this.to.y - this.from.y) * t,
    };
  }

  private offsetNow(now: number): Point {
    const fade = Math.exp(-(now - this.offsetAt) / this.smoothingMs);
    return { x: this.offset.x * fade, y: this.offset.y * fade };
  }
}
