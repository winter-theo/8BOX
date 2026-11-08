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
