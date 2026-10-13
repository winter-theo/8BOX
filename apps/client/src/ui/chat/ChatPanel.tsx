import { CHAT, type ChatChannel } from '@8box/shared';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import {
  type ChatEntry,
  entriesOf,
  markRead,
  receiveChatNotice,
  unreadCount,
  useChatStore,
} from '../../store/chat';

const TABS: readonly ChatChannel[] = ['proximity', 'private'];

function useTimeFormat(): (ms: number) => string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeStyle: 'short' });
    return (ms: number) => format.format(new Date(ms));
  }, [i18n.resolvedLanguage]);
}

function ChatEntryView({
  entry,
  formatTime,
}: {
  entry: ChatEntry;
  formatTime: (ms: number) => string;
}) {
  const { t } = useTranslation();
  if (entry.kind === 'notice') {
    return (
      <li className="chat-entry chat-entry--notice">
        {t(`ui.chat.notice.${entry.notice}`, {
          name: entry.name,
          time: entry.until === undefined ? '' : formatTime(entry.until),
          max: CHAT.maxMessageLength,
        })}
      </li>
    );
  }
  let speaker = entry.from;
  if (entry.channel === 'private') {
    speaker = entry.own
      ? t('ui.chat.to', { name: entry.to })
      : t('ui.chat.from', { name: entry.from });
  }
  return (
    <li className={entry.own ? 'chat-entry chat-entry--own' : 'chat-entry'}>
      <time className="chat-time">{formatTime(entry.ts)}</time>{' '}
      <span className="chat-name">{speaker}</span> <span className="chat-text">{entry.text}</span>
    </li>
  );
}

/**
 * The chat: lines said nearby and private lines in two tabs, and a line to write (commands `/msg`,
 * `/r`, `/signaler`). On a computer it stays at the bottom left and Enter starts writing; on a phone
 * the chat button opens it. In the Private tab, a plain line answers the last private partner.
 */
export function ChatPanel({ touch }: { touch: boolean }) {
  const { t } = useTranslation();
  const formatTime = useTimeFormat();
  const entries = useChatStore((state) => state.entries);
  const partner = useChatStore((state) => state.partner);
  const tab = useChatStore((state) => state.tab);
  const open = useChatStore((state) => state.open) || !touch;
  const unread = {
    proximity: useChatStore((state) => unreadCount(state, 'proximity')),
    private: useChatStore((state) => unreadCount(state, 'private')),
  };
  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const shown = entriesOf(entries, tab);
  const lastId = entries.at(-1)?.id ?? 0;

  // Lines of the tab on screen are read; the newest line stays in view.
  useEffect(() => {
    if (open) {
      markRead(tab, lastId);
    }
    const log = logRef.current;
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [open, tab, lastId]);

  // On a computer, Enter starts writing (unless another field is being typed in).
  useEffect(() => {
    if (touch) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== 'Enter' ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [touch]);

  if (!open) {
    return null;
  }

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text !== '') {
      if (tab === 'private' && !text.startsWith('/')) {
        if (partner === null) {
          receiveChatNotice({ t: 'chatNotice', notice: 'msgUsage' }); // Nobody to answer yet.
          return;
        }
        gameClient.say(text, partner);
      } else {
        gameClient.say(text);
      }
      setDraft('');
    }
    if (!touch) {
      inputRef.current?.blur(); // Back to the game.
    }
  };

  let placeholder = t('ui.chat.write');
  if (!touch && !writing) {
    placeholder = t('ui.chat.pressEnter');
  } else if (tab === 'private') {
    placeholder =
      partner === null ? t('ui.chat.privateHint') : t('ui.chat.replyTo', { name: partner });
  }

  return (
    <section className={writing ? 'chat chat--active' : 'chat'} aria-label={t('ui.chat.title')}>
      <div className="chat-tabs" role="tablist">
        {TABS.map((channel) => (
          <button
            key={channel}
            type="button"
            role="tab"
            aria-selected={tab === channel}
            className={tab === channel ? 'chat-tab chat-tab--active' : 'chat-tab'}
            onClick={() => useChatStore.setState({ tab: channel })}
          >
            {t(`ui.chat.tab.${channel}`)}
            {tab !== channel && unread[channel] > 0 && (
              <span className="badge">{unread[channel]}</span>
            )}
          </button>
        ))}
        {touch && (
          <button
            type="button"
            className="chat-close"
            aria-label={t('ui.chat.close')}
            onClick={() => useChatStore.setState({ open: false })}
          >
            ×
          </button>
        )}
      </div>
      <ol className="chat-log" ref={logRef} aria-live="polite">
        {shown.length === 0 ? (
          <li className="chat-entry chat-entry--hint">
            {tab === 'proximity'
              ? t('ui.chat.emptyProximity', { radius: CHAT.proximityRadiusTiles })
              : t('ui.chat.emptyPrivate')}
          </li>
        ) : (
          shown.map((entry) => (
            <ChatEntryView key={entry.id} entry={entry} formatTime={formatTime} />
          ))
        )}
      </ol>
      <form className="chat-form" onSubmit={send}>
        <input
          ref={inputRef}
          className="chat-input"
          aria-label={t('ui.chat.message')}
          placeholder={placeholder}
          value={draft}
          maxLength={CHAT.maxLineLength}
          enterKeyHint="send"
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setWriting(true)}
          onBlur={() => setWriting(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur();
            }
          }}
        />
        <button type="submit" className="chat-send">
          {t('ui.chat.send')}
        </button>
      </form>
    </section>
  );
}
