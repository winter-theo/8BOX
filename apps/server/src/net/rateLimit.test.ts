import { describe, expect, it } from 'vitest';
import { TokenBucket } from './rateLimit';

function takeMany(bucket: TokenBucket, count: number, now: number): number {
  let accepted = 0;
  for (let i = 0; i < count; i++) {
    if (bucket.take(now)) {
      accepted++;
    }
  }
  return accepted;
}

describe('TokenBucket', () => {
  it('accepts a burst up to its capacity, then refuses', () => {
    const bucket = new TokenBucket(30, 1000, 0);

    expect(takeMany(bucket, 40, 0)).toBe(30);
  });

  it('refills at capacity per window', () => {
    const bucket = new TokenBucket(30, 1000, 0);
    takeMany(bucket, 30, 0);

    expect(takeMany(bucket, 10, 100)).toBe(3); // 100 ms = 3 tokens
    expect(takeMany(bucket, 40, 1100)).toBe(30); // a full window refills completely
  });

  it('never stores more than its capacity', () => {
    const bucket = new TokenBucket(5, 10_000, 0);

    expect(takeMany(bucket, 10, 1_000_000)).toBe(5);
  });

  it('keeps a steady rate at the limit', () => {
    const bucket = new TokenBucket(5, 1000, 0);
    takeMany(bucket, 5, 0);
    let accepted = 0;
    for (let t = 1; t <= 10_000; t += 10) {
      if (bucket.take(t)) {
        accepted++;
      }
    }
    expect(accepted).toBeGreaterThanOrEqual(49);
    expect(accepted).toBeLessThanOrEqual(51);
  });
});
