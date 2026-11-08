import { CHAT, type ChatNoticeMessage, contentNameKey } from '@8box/shared';
import type { TFunction } from 'i18next';

/** A notice of the server, as the chat keeps it. */
export type NoticeFields = Omit<ChatNoticeMessage, 't'>;

/** How to use a command, in the player's language (`/tp <joueur> ou /tp <x> <y> [couche]`). */
function usageOf(t: TFunction, command: string): string {
  return t(`ui.chat.commands.${command}.usage`);
}

/**
 * The text of a notice: what the server said about a line or a command, translated, with the names,
 * items and values it carries. `/aide` gives one line per command.
 */
export function noticeText(
  t: TFunction,
  notice: NoticeFields,
  formatTime: (ms: number) => string,
): string {
  const { command, thing, list = [], values = {} } = notice;
  const options = {
    name: notice.name ?? '',
    time: notice.until === undefined ? '' : formatTime(notice.until),
    max: CHAT.maxMessageLength,
    list: list.join(', '),
    count: list.length,
    usage: command === undefined ? '' : usageOf(t, command),
    thing: thing === undefined ? '' : t(contentNameKey(thing)),
    ...values,
  };
  switch (notice.notice) {
    case 'help':
      return [
        t('ui.chat.notice.help'),
        ...list.map((id) =>
          t('ui.chat.helpLine', { usage: usageOf(t, id), help: t(`ui.chat.commands.${id}.help`) }),
        ),
      ].join('\n');
    case 'done':
      return t(`ui.chat.commands.${command}.done`, options);
    case 'refused':
      return notice.reason === 'wrongStatus'
        ? t(`ui.chat.commands.${command}.wrongStatus`, options)
        : t(`ui.chat.refused.${notice.reason}`, options);
    default:
      return t(`ui.chat.notice.${notice.notice}`, options);
  }
}
