/** Action keys by physical position (`KeyboardEvent.code`): E for the main action, Space to use. */
const KEY_ACTIONS: Readonly<Record<string, 'main' | 'use'>> = {
  KeyE: 'main',
  Space: 'use',
};

/** What a key does: the main action on the aimed tile, using the item in hand, or nothing. */
export function actionOfCode(code: string): 'main' | 'use' | undefined {
  return KEY_ACTIONS[code];
}
