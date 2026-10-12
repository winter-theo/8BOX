/**
 * Token bucket: allows bursts of up to `capacity` actions, refilled at `capacity` per `windowMs`.
 * Time comes from the caller (ms), so it is easy to test.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = now;
  }

  /** Takes one token. Returns false when the bucket is empty (action refused). */
  take(now: number): boolean {
    const elapsed = Math.max(0, now - this.lastRefill);
    this.lastRefill = now;
    this.tokens = Math.min(this.capacity, this.tokens + (elapsed * this.capacity) / this.windowMs);
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }
}
