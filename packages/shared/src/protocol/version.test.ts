import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '../index';

describe('PROTOCOL_VERSION', () => {
  it('is exported from the package entry point as a positive integer', () => {
    expect(PROTOCOL_VERSION).toBe(9);
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
  });
});
