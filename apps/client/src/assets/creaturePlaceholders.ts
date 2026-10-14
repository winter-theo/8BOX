import { PALETTE } from './palette';
import { type Legend, type Placeholder, pixelSprite } from './pixelSprite';

const P = PALETTE;

// Creatures face right, like the character sheets: they are flipped to face left.

const CREATURE: Legend = {
  o: P.ink,
  k: P.leaf,
  g: P.grass,
  e: P.grassLight,
  p: P.grassPale,
  w: P.bone,
  s: P.slate,
  n: P.navy,
  v: P.silver,
  r: P.berry,
};

const creature = (rows: readonly string[]) => pixelSprite(CREATURE, [{ weight: 1, rows }]);

/** Placeholders of the creatures, by sprite id. */
export const CREATURE_PLACEHOLDERS: Readonly<Record<string, Placeholder>> = {
  // Slime: a green blob with two eyes.
  'creature.slime': creature([
    '...oooo...',
    '..oeppeo..',
    '.oegggggo.',
    '.ogowgowo.',
    'oggggggggo',
    'oggggggggo',
    'okkkkkkkko',
    '.oooooooo.',
  ]),
  // Prowler: a lean grey beast on four legs, with a red eye and a white fang.
  'creature.prowler': creature([
    '.........oo.',
    'o.......osso',
    'osooooooosro',
    '.osssssssswo',
    '..osvvvvssoo',
    '..onsonnnso.',
    '..os.os.os..',
    '..oo.oo.oo..',
  ]),
};
