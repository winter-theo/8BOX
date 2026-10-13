import { describe, expect, it } from 'vitest';
import { hotbarSlotOfCode } from './InventoryKeys';

describe('hotbarSlotOfCode', () => {
  it('maps the digit keys 1 to 9, then 0, to the 10 hotbar slots', () => {
    expect(hotbarSlotOfCode('Digit1')).toBe(0);
    expect(hotbarSlotOfCode('Digit9')).toBe(8);
    expect(hotbarSlotOfCode('Digit0')).toBe(9);
    expect(hotbarSlotOfCode('Numpad3')).toBe(2);
  });

  it('ignores other keys', () => {
    expect(hotbarSlotOfCode('KeyQ')).toBeUndefined();
    expect(hotbarSlotOfCode('NumpadAdd')).toBeUndefined();
    expect(hotbarSlotOfCode('Minus')).toBeUndefined();
  });
});
