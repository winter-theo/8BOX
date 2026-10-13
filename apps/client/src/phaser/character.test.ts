import { PLAYER, VIEW } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { placeholderFor } from '../assets/placeholders';
import { characterFrame, characterSprite, spriteSide } from './character';

describe('characterFrame', () => {
  it('rests when still', () => {
    expect(characterFrame(false, 0)).toBe('idle');
    expect(characterFrame(false, 12_345)).toBe('idle');
  });

  it('alternates the two walking frames', () => {
    expect(characterFrame(true, 0)).toBe('walk1');
    expect(characterFrame(true, VIEW.walkFrameMs)).toBe('walk2');
    expect(characterFrame(true, 2 * VIEW.walkFrameMs)).toBe('walk1');
  });
});

describe('spriteSide', () => {
  it('turns left or right, and keeps its side going up or down', () => {
    expect(spriteSide('left', 'right')).toBe('left');
    expect(spriteSide('right', 'left')).toBe('right');
    expect(spriteSide('up', 'left')).toBe('left');
    expect(spriteSide('down', 'right')).toBe('right');
  });
});

describe('characterSprite', () => {
  it('names a frame of a skin, with an 8 × 8 placeholder for each frame of every skin', () => {
    expect(characterSprite('default', 'walk2')).toBe('char.default.walk2');
    for (const skin of PLAYER.skins) {
      for (const frame of ['idle', 'walk1', 'walk2'] as const) {
        expect(placeholderFor(characterSprite(skin, frame)), `${skin} ${frame}`).toMatchObject({
          width: 8,
          height: 8,
        });
      }
    }
  });
});
