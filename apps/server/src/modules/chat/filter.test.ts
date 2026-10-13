import { CHAT } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { cleanChatText, parseChatLine } from './commands';
import { createChatFilter } from './filter';

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
  it('reads commands, in French and in English', () => {
    expect(parseChatLine('salut')).toEqual({ kind: 'say', text: 'salut' });
    expect(parseChatLine('/msg Bob on se voit au lac ?')).toEqual({
      kind: 'msg',
      to: 'Bob',
      text: 'on se voit au lac ?',
    });
    expect(parseChatLine('/R ok')).toEqual({ kind: 'reply', text: 'ok' });
    expect(parseChatLine('/signaler Bob insultes')).toEqual({
      kind: 'report',
      name: 'Bob',
      reason: 'insultes',
    });
    expect(parseChatLine('/report Bob spam')).toEqual({
      kind: 'report',
      name: 'Bob',
      reason: 'spam',
    });
  });

  it('tells how to use a command used wrongly', () => {
    expect(parseChatLine('/msg Bob')).toEqual({ kind: 'usage', notice: 'msgUsage' });
    expect(parseChatLine('/r')).toEqual({ kind: 'usage', notice: 'msgUsage' });
    expect(parseChatLine('/signaler Bob')).toEqual({ kind: 'usage', notice: 'reportUsage' });
    expect(parseChatLine('/dance')).toEqual({ kind: 'unknown' });
    expect(parseChatLine('/')).toEqual({ kind: 'unknown' });
  });

  it('cleans control characters and spaces', () => {
    expect(cleanChatText('  a\nb\t\tc ‮d  ')).toBe('a b c d');
    expect(cleanChatText(' \n ')).toBe('');
  });
});
