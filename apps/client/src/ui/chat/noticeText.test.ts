import { i18nResources } from '@8box/shared';
import i18next, { type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { type NoticeFields, noticeText } from './noticeText';

let fr: TFunction;
let en: TFunction;

beforeAll(async () => {
  const i18n = i18next.createInstance();
  await i18n.init({
    resources: i18nResources,
    lng: 'fr',
    interpolation: { escapeValue: false },
  });
  fr = i18n.getFixedT('fr');
  en = i18n.getFixedT('en');
});

const formatTime = (ms: number) => `t${ms}`;
const text = (t: TFunction, notice: NoticeFields) => noticeText(t, notice, formatTime);

describe('chat notices', () => {
  it('show how to use a command, in the language of the player', () => {
    expect(text(fr, { notice: 'usage', command: 'report' })).toBe(
      'Utilisation : /signaler <joueur> <raison>',
    );
    expect(text(en, { notice: 'usage', command: 'report' })).toBe(
      'Usage: /report <player> <reason>',
    );
  });

  it('list the commands of /aide, one per line', () => {
    expect(text(en, { notice: 'help', list: ['help', 'tp'] }).split('\n')).toEqual([
      'Commands:',
      '/help: the commands you can use',
      '/tp <player> or /tp <x> <y> [layer]: teleport yourself',
    ]);
  });

  it('name items with their translated name, and show the values', () => {
    const given: NoticeFields = {
      notice: 'done',
      command: 'give',
      name: 'Bob',
      thing: 'base:oak_log',
      values: { count: 10 },
    };
    expect(text(fr, given)).toBe('Bob reçoit 10 × Bûche de chêne.');
    expect(text(en, { notice: 'done', command: 'time', values: { clock: '22:00' } })).toBe(
      'It is now 22:00.',
    );
    expect(text(fr, { notice: 'who', list: ['Ana', 'Bob'] })).toBe('En ligne (2) : Ana, Bob.');
  });

  it('tell why a command was refused', () => {
    expect(
      text(fr, { notice: 'refused', command: 'unmute', reason: 'wrongStatus', name: 'Bob' }),
    ).toBe("Bob n'est pas muet.");
    expect(
      text(en, { notice: 'refused', command: 'give', reason: 'inventoryFull', name: 'Bob' }),
    ).toBe("Bob's inventory is full.");
    expect(text(en, { notice: 'muted', until: 5 })).toBe('An admin muted you until t5.');
  });

  it('have a text for every command, refusal and notice the server sends', () => {
    const commands = ['help', 'msg', 'reply', 'report', 'tp', 'tphere', 'give', 'heal', 'time'];
    const more = ['who', 'announce', 'save', 'spawnmob', 'kick', 'ban', 'unban', 'mute', 'unmute'];
    for (const t of [fr, en]) {
      for (const command of [...commands, ...more, 'admin']) {
        expect(text(t, { notice: 'usage', command })).not.toContain('ui.chat');
      }
      for (const reason of [
        'targetIsAdmin',
        'dead',
        'outside',
        'blocked',
        'noRoom',
        'failed',
      ] as const) {
        expect(text(t, { notice: 'refused', command: 'tp', reason })).not.toContain('ui.chat');
      }
      for (const command of ['tp', 'tphere', 'give', 'heal', 'time', 'save', 'spawnmob', 'kick']) {
        expect(text(t, { notice: 'done', command })).not.toContain('ui.chat');
      }
    }
  });
});
