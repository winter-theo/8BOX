import { CHAT } from '@8box/shared';

/** Text of a speech bubble: the message, cut to `maxLength` characters with "…". */
export function bubbleText(text: string, maxLength: number = CHAT.bubbleMaxLength): string {
  const chars = [...text];
  return chars.length <= maxLength
    ? text
    : `${chars
        .slice(0, maxLength - 1)
        .join('')
        .trimEnd()}…`;
}
