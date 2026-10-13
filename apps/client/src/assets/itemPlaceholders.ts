import { PALETTE } from './palette';
import { type Legend, type Placeholder, pixelSprite } from './pixelSprite';

const P = PALETTE;

// Items are 8 × 8: the same sprite in the inventory and lying on the ground.

const ITEM: Legend = {
  o: P.ink,
  d: P.soilDark,
  b: P.soil,
  l: P.soilLight,
  s: P.sandLight,
  k: P.leaf,
  e: P.grassLight,
  r: P.berry,
  w: P.bone,
  p: P.petal,
  y: P.sand,
};

const item = (rows: readonly string[]) => pixelSprite(ITEM, [{ weight: 1, rows }]);

/** Placeholders of the items, by sprite id. */
export const ITEM_PLACEHOLDERS: Readonly<Record<string, Placeholder>> = {
  'item.oak_log': item([
    '........',
    '.oooooo.',
    'osbbbbbo',
    'oslbbbbo',
    'osdddddo',
    '.oooooo.',
    '........',
    '........',
  ]),
  'item.plank': item([
    '........',
    '........',
    'oooooooo',
    'ollllllo',
    'obbbbbbo',
    'oooooooo',
    '........',
    '........',
  ]),
  'item.stick': item([
    '......o.',
    '.....olo',
    '....olo.',
    '...olo..',
    '..olo...',
    '.olo....',
    'olo.....',
    '.o......',
  ]),
  'item.fiber': item([
    '........',
    '..e..e..',
    '.e.ee.e.',
    '..ekke..',
    '.e.kk.e.',
    '..e..e..',
    '...kk...',
    '........',
  ]),
  'item.berries': item([
    '....k...',
    '...kk...',
    '..rr.rr.',
    '.rwrrwrr',
    '.rrr.rrr',
    '..r.rrr.',
    '...rrr..',
    '........',
  ]),
  'item.apple': item([
    '....d...',
    '...dk...',
    '.rrrrrr.',
    'rwrrrrrr',
    'rwrrrrrr',
    'rrrrrrrr',
    '.rrrrrr.',
    '..rr.rr.',
  ]),
  'item.gold': item([
    '........',
    '..oooo..',
    '.oppppo.',
    '.opwypo.',
    '.opyypo.',
    '.oppppo.',
    '..oooo..',
    '........',
  ]),
  'item.fiber_bag': item([
    '...oo...',
    '..o..o..',
    '.oooooo.',
    'oeeeeeeo',
    'oekeekeo',
    'oeeeeeeo',
    'oekkkkeo',
    '.oooooo.',
  ]),
};
