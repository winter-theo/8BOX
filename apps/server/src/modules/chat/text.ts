/** What a chat line asks for, once read. */
export type ChatLine =
  /** Said aloud to the players nearby. */
  | { kind: 'say'; text: string }
  /** `/msg <name> <text>`: a private message. */
  | { kind: 'msg'; to: string; text: string }
  /** `/r <text>`: a private answer to the last player who sent one. */
  | { kind: 'reply'; text: string }
  /** `/signaler <name> <reason>` (`/report` in English): a report to the admin. */
  | { kind: 'report'; name: string; reason: string }
  /** A command used the wrong way. */
  | { kind: 'usage'; notice: 'msgUsage' | 'reportUsage' }
  /** A line starting with "/" that is no command. */
  | { kind: 'unknown' };

/** Commands of the chat (French and English names), without their "/". */
const COMMANDS: Readonly<Record<string, 'msg' | 'reply' | 'report'>> = {
  msg: 'msg',
  r: 'reply',
  signaler: 'report',
  report: 'report',
};

/** Splits "word rest of the line" at its first space. */
function firstWord(text: string): [string, string] {
  const space = text.indexOf(' ');
  return space === -1 ? [text, ''] : [text.slice(0, space), text.slice(space + 1).trim()];
}

/** Reads a chat line, already cleaned (`cleanChatText`): a plain message or a command. */
export function parseChatLine(text: string): ChatLine {
  if (!text.startsWith('/')) {
    return { kind: 'say', text };
  }
  const [command, rest] = firstWord(text.slice(1));
  switch (COMMANDS[command.toLowerCase()]) {
    case 'msg': {
      const [to, message] = firstWord(rest);
      return to === '' || message === ''
        ? { kind: 'usage', notice: 'msgUsage' }
        : { kind: 'msg', to, text: message };
    }
    case 'reply':
      return rest === '' ? { kind: 'usage', notice: 'msgUsage' } : { kind: 'reply', text: rest };
    case 'report': {
      const [name, reason] = firstWord(rest);
      return name === '' || reason === ''
        ? { kind: 'usage', notice: 'reportUsage' }
        : { kind: 'report', name, reason };
    }
    default:
      return { kind: 'unknown' };
  }
}

/**
 * A chat line as the server keeps it: control and text direction characters become spaces, spaces
 * are merged, and the ends trimmed.
 */
export function cleanChatText(text: string): string {
  return text
    .replace(/[\p{Cc}‪-‮⁦-⁩]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
