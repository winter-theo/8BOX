import { describe, expect, it } from 'vitest';
import { checkPlayerName } from './names';

describe('checkPlayerName', () => {
  it('accepts names of 3 to 16 letters, digits and underscores', () => {
    for (const name of [
      'Ana',
      'Theo_Winter_2026',
      'bot_01',
      'Computer',
      'Technique',
      'Constance',
    ]) {
      expect(checkPlayerName(name), name).toBe('ok');
    }
  });

  it('refuses a bad format', () => {
    for (const name of ['', 'ab', 'a'.repeat(17), 'Théo', 'Ana Bob', 'ana-bob', 'ana!']) {
      expect(checkPlayerName(name), name).toBe('invalid');
    }
  });

  it('refuses forbidden words anywhere, even with look-alike digits', () => {
    for (const name of [
      'Connard',
      'xXconnardXx',
      'C0nn4rd',
      'TheAdmin',
      'Mod_erateur',
      'fuckyou',
    ]) {
      expect(checkPlayerName(name), name).toBe('forbidden');
    }
  });

  it('refuses short forbidden words only as a whole part of the name', () => {
    for (const name of ['pute', 'Theo_pute', 'TheoPute', 'fdp_2', 'Le_Modo', 'GM_Theo']) {
      expect(checkPlayerName(name), name).toBe('forbidden');
    }
  });
});
