import { describe, expect, it } from 'vitest';
import { actionOfCode } from './actionKeys';

describe('actionOfCode', () => {
  it('reads keys by physical position: E for the main action, Space to use', () => {
    expect(actionOfCode('KeyE')).toBe('main');
    expect(actionOfCode('Space')).toBe('use');
    expect(actionOfCode('KeyQ')).toBeUndefined();
    expect(actionOfCode('Enter')).toBeUndefined();
  });
});
