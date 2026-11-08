import { CHAT } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { createChatFilter } from './filter';
import { cleanChatText } from './text';

const filter = createChatFilter([...CHAT.filteredWords.fr, ...CHAT.filteredWords.en], '***');

describe('chat filter', () => {
  it('hides listed words in French and in English, whatever their case and accents', () => {
    expect(filter('Espèce de CONNARD !')).toBe('Espèce de *** !');
    expect(filter('t es un enculé')).toBe('t es un ***');
    expect(filter('what the fuck man')).toBe('what the *** man');
  });

  it('reads plurals, longer forms, digits and repeated letters', () => {
    expect(filter('bande de cons')).toBe('bande de ***');
    expect(filter('fucking hell, motherfucker')).toBe('*** hell, ***');
    expect(filter('c0nn4rd')).toBe('***');
    expect(filter('fuuuuck')).toBe('***');
    expect(filter('$hit')).toBe('***');
    expect(filter('fils-de-pute')).toBe('***');
  });

  it('keeps innocent words that contain or look like a listed one', () => {
    for (const text of [
      'je suis content',
      'un pique-nique au lac',
      'ma salopette bleue',
      'un fagot de bois',
      'je suis en retard',
      'computer science',
      'un cocktail',
      'la Mongolie',
    ]) {
      expect(filter(text)).toBe(text);
    }
  });

  it('changes nothing without words', () => {
    expect(createChatFilter([], '***')('connard')).toBe('connard');
  });
});

describe('chat lines', () => {
  it('cleans control characters and spaces', () => {
    expect(cleanChatText('  a\nb\t\tc ‮d  ')).toBe('a b c d');
    expect(cleanChatText(' \n ')).toBe('');
  });
});
