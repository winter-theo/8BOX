import { describe, expect, it } from 'vitest';
import { parseSlotRef } from './itemDrag';

describe('parseSlotRef', () => {
  it('reads slot indexes and equipment slots from data attributes', () => {
    expect(parseSlotRef('0')).toBe(0);
    expect(parseSlotRef('14')).toBe(14);
    expect(parseSlotRef('bag')).toBe('bag');
    expect(parseSlotRef('head')).toBe('head');
  });

  it('rejects anything else', () => {
    for (const value of [undefined, '', '-1', '1.5', 'purse', 'feet']) {
      expect(parseSlotRef(value)).toBeUndefined();
    }
  });
});
