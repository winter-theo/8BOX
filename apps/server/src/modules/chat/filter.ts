/** Characters read as letters: "c0n" is "con", "@" an "a". */
const LOOK_ALIKES: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
};

/** A word of a chat line: letters, digits and look-alikes; hyphenated words count as one. */
const WORD = /[\p{L}\p{N}@$]+(?:-[\p{L}\p{N}@$]+)*/gu;

/** Lower case, without accents, look-alikes read as letters. */
function fold(word: string): string {
  return [...word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()]
    .map((char) => LOOK_ALIKES[char] ?? char)
    .join('');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pattern of a word of the list: each letter may repeat; "word*" also matches longer words. */
function wordPattern(entry: string): string {
  const prefix = entry.endsWith('*');
  const letters = fold(prefix ? entry.slice(0, -1) : entry);
  const body = [...letters].map((char) => `${escapeRegExp(char)}+`).join('');
  return prefix ? `${body}.*` : `${body}[sx]*`;
}

/** Hides the words of `words` (`CHAT.filteredWords` rules) in a chat line, each one by `mask`. */
export function createChatFilter(words: readonly string[], mask: string): (text: string) => string {
  if (words.length === 0) {
    return (text) => text;
  }
  const matcher = new RegExp(`^(?:${words.map(wordPattern).join('|')})$`, 'u');
  return (text) => text.replace(WORD, (word) => (matcher.test(fold(word)) ? mask : word));
}
