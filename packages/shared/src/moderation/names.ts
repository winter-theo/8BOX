import { PLAYER } from '../config/player';

/** Why a name was refused: wrong format, forbidden word, or already used by another player. */
export type NameError = 'invalid' | 'forbidden' | 'taken';

/**
 * Words refused anywhere in a name (insults, staff impersonation). Short list in French and English, to
 * extend with the chat filter (step 13). Compared after `normalize`.
 */
const FORBIDDEN_ANYWHERE = [
  'admin',
  'moderat',
  'connard',
  'connasse',
  'salope',
  'encule',
  'batard',
  'negre',
  'pedophile',
  'hitler',
  'nazi',
  'fuck',
  'shit',
  'bitch',
  'nigger',
  'nigga',
  'faggot',
  'whore',
  'cunt',
];

/** Short words refused only as a whole part of a name ("pute" is in "computer"). */
const FORBIDDEN_PARTS = new Set([
  'pute',
  'pd',
  'fdp',
  'ntm',
  'nique',
  'merde',
  'con',
  'modo',
  'mod',
  'gm',
  'staff',
  'system',
  'server',
  'serveur',
  'retard',
]);

/** Look-alike characters read as letters: "c0nn4rd" is "connard". */
const LOOK_ALIKES: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
};

function normalize(text: string): string {
  return [...text.toLowerCase()].map((char) => LOOK_ALIKES[char] ?? char).join('');
}

/** Parts of a name, split at underscores and at lower → upper case changes: "TheoPute_2" → theo, pute, 2. */
function parts(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split('_')
    .filter((part) => part.length > 0)
    .map(normalize);
}

/** Checks a player name: format (`PLAYER` rules), then forbidden words. Uniqueness is checked by the server. */
export function checkPlayerName(name: string): 'ok' | Exclude<NameError, 'taken'> {
  if (
    name.length < PLAYER.nameMinLength ||
    name.length > PLAYER.nameMaxLength ||
    !PLAYER.namePattern.test(name)
  ) {
    return 'invalid';
  }
  const whole = normalize(name).replaceAll('_', '');
  if (FORBIDDEN_ANYWHERE.some((word) => whole.includes(word))) {
    return 'forbidden';
  }
  if (parts(name).some((part) => FORBIDDEN_PARTS.has(part))) {
    return 'forbidden';
  }
  return 'ok';
}
