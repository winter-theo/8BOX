import { CHAT } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { bubbleText } from './bubbleText';

describe('bubbleText', () => {
  it('keeps a short message, cuts a long one with "…"', () => {
    expect(bubbleText('salut')).toBe('salut');
    const long = 'a'.repeat(CHAT.bubbleMaxLength + 10);
    const cut = bubbleText(long);
    expect([...cut]).toHaveLength(CHAT.bubbleMaxLength);
    expect(cut.endsWith('…')).toBe(true);
    expect(bubbleText('un deux trois quatre', 9)).toBe('un deux…');
  });
});
