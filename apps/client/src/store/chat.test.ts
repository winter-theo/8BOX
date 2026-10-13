import { CHAT, type ChatLineMessage } from '@8box/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearChat,
  entriesOf,
  markRead,
  receiveChatLine,
  receiveChatNotice,
  unreadCount,
  useChatStore,
} from './chat';

const line = (changes: Partial<ChatLineMessage>): ChatLineMessage => ({
  t: 'chat',
  channel: 'proximity',
  from: 'Bob',
  text: 'salut',
  ts: 1,
  ...changes,
});

const chat = () => useChatStore.getState();

beforeEach(() => clearChat());

describe('chat store', () => {
  it('keeps the last lines only', () => {
    for (let i = 0; i < CHAT.historySize + 3; i++) {
      receiveChatLine(line({ text: `line ${i}` }), 'Ana');
    }
    expect(chat().entries).toHaveLength(CHAT.historySize);
    expect(chat().entries[0]).toMatchObject({ text: 'line 3' });
  });

  it('answers the other player of the last private line, sent or received', () => {
    receiveChatLine(line({ channel: 'private', from: 'Bob', to: 'Ana' }), 'Ana');
    expect(chat().partner).toBe('Bob');
    receiveChatLine(line({ channel: 'private', from: 'Ana', to: 'Cid' }), 'Ana');
    expect(chat().partner).toBe('Cid');
    receiveChatLine(line({ from: 'Dan' }), 'Ana');
    expect(chat().partner).toBe('Cid');
  });

  it('counts the unread lines of each tab, never the own ones', () => {
    receiveChatLine(line({ from: 'Bob' }), 'Ana');
    receiveChatLine(line({ from: 'Ana' }), 'Ana');
    receiveChatLine(line({ channel: 'private', from: 'Bob', to: 'Ana' }), 'Ana');
    receiveChatNotice({ t: 'chatNotice', notice: 'tooFast' });
    expect(unreadCount(chat(), 'proximity')).toBe(1);
    expect(unreadCount(chat(), 'private')).toBe(1);

    markRead('proximity', chat().entries.at(-1)?.id ?? 0);
    expect(unreadCount(chat(), 'proximity')).toBe(0);
    expect(unreadCount(chat(), 'private')).toBe(1);
  });

  it('shows the lines of a tab and every notice', () => {
    receiveChatLine(line({ text: 'near' }), 'Ana');
    receiveChatLine(line({ channel: 'private', to: 'Ana', text: 'secret' }), 'Ana');
    receiveChatNotice({ t: 'chatNotice', notice: 'self' });
    const texts = (channel: 'proximity' | 'private') =>
      entriesOf(chat().entries, channel).map((entry) =>
        entry.kind === 'line' ? entry.text : entry.notice,
      );
    expect(texts('proximity')).toEqual(['near', 'self']);
    expect(texts('private')).toEqual(['secret', 'self']);
  });
});
