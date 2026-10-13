import { describe, expect, it } from 'vitest';
import { gaugeIcon } from './Vitals';

describe('gaugeIcon', () => {
  it('shows 2 points per icon: full, half, then empty', () => {
    const icons = (value: number) =>
      Array.from({ length: 10 }, (_, index) => gaugeIcon('hud.heart', value, index).slice(10));
    expect(icons(20)).toEqual(Array(10).fill('full'));
    expect(icons(0)).toEqual(Array(10).fill('empty'));
    expect(icons(5)).toEqual(['full', 'full', 'half', ...Array(7).fill('empty')]);
  });
});
