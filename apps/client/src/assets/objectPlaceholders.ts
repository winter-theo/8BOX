import { PALETTE } from './palette';
import { type Legend, type Placeholder, pixelSprite } from './pixelSprite';

const P = PALETTE;

// Objects stand on their tile in the 3/4 view: a sprite is anchored at the bottom of its tile, and a
// tall one (8 × 16) rises over the tile above (foliage, the top of a wall).

const TREE: Legend = {
  o: P.ink,
  k: P.leafDark,
  e: P.leaf,
  g: P.grassDark,
  l: P.grassLight,
  t: P.soilDark,
  b: P.soil,
  r: P.berry,
};

const TRUNK = ['...ob...', '...tb...', '...tb...', '...tb...', '...tb...', '..ttbb..'];

const oakTree = pixelSprite(TREE, [
  {
    weight: 3,
    rows: [
      '..kkkk..',
      '.keeglk.',
      'keegllgk',
      'keeeggek',
      'kgeeeeek',
      'keeekegk',
      'kekeeeek',
      'keeeekek',
      'kkekeekk',
      '.kkkkkk.',
      ...TRUNK,
    ],
  },
  {
    weight: 2,
    rows: [
      '...kkk..',
      '..keglk.',
      '.keegllk',
      'keeeeggk',
      'kgekeeek',
      'keeeeekk',
      'kkeegeek',
      'keeeeeek',
      'kkeekekk',
      '.kkkkkk.',
      ...TRUNK,
    ],
  },
  {
    weight: 1,
    rows: [
      '..kkkk..',
      '.keeglk.',
      'kreegllk',
      'keeeggek',
      'kgeereek',
      'keeekegk',
      'kreeeeek',
      'keeeerek',
      'kkekeekk',
      '.kkkkkk.',
      ...TRUNK,
    ],
  },
]);

const berryBush = pixelSprite(TREE, [
  {
    weight: 1,
    rows: [
      '........',
      '..kkkk..',
      '.keglek.',
      'kergeerk',
      'keeeerek',
      'kreeegek',
      'kkeekekk',
      '.kkkkkk.',
    ],
  },
  {
    weight: 1,
    rows: [
      '........',
      '.kkk.kk.',
      'kegrkgek',
      'keeeeeek',
      'kreegrek',
      'keeeeeek',
      'kkerekkk',
      '.kkkkkk.',
    ],
  },
]);

const BLADES: Legend = { p: P.grassPale, l: P.grassLight, d: P.grassDark, k: P.leafDark };

const tallGrass = pixelSprite(BLADES, [
  {
    weight: 1,
    rows: [
      '........',
      '.p....l.',
      '.l.p..l.',
      '.dl.l.d.',
      'ldd.dld.',
      'dkd.dkdl',
      '.k.k.kd.',
      '........',
    ],
  },
  {
    weight: 1,
    rows: [
      '........',
      '...l....',
      'p..l.p..',
      'l.dl.l.p',
      'd.dd.dll',
      'dk.k.ddd',
      '.k.k.kk.',
      '........',
    ],
  },
  {
    weight: 1,
    rows: [
      '........',
      '......p.',
      '.l.p..l.',
      '.ldl.ld.',
      'pdd.ldd.',
      'ldk.dkd.',
      '.k..k.k.',
      '........',
    ],
  },
]);

const FLOWERS: Legend = { y: P.petal, w: P.bone, b: P.blossom, c: P.soilLight, d: P.grassDark };

const flowers = pixelSprite(FLOWERS, [
  {
    weight: 1,
    rows: [
      '........',
      '.y...w..',
      'ycy.wyw.',
      '.y...w..',
      '.d.b.d..',
      '.dbyb...',
      '...b....',
      '...d....',
    ],
  },
  {
    weight: 1,
    rows: [
      '........',
      '....b...',
      '.w.byb..',
      'wyw.b...',
      '.w..d.y.',
      '.d...ycy',
      '.d....y.',
      '......d.',
    ],
  },
  {
    weight: 1,
    rows: [
      '........',
      '......w.',
      '..y..wyw',
      '.ycy..w.',
      '..y...d.',
      '..d.b.d.',
      '...byb..',
      '....b...',
    ],
  },
]);

const WOOD: Legend = { O: P.ink, B: P.soilDark, b: P.soil, L: P.soilLight, y: P.petal };

/** Top of a wall seen from above: it covers the tile above the wall. */
const WALL_TOP = [
  'BBBBBBBB',
  'BLLLLLLB',
  'BLLbLLLB',
  'BLLLLLLB',
  'BLLLLbLB',
  'BLbLLLLB',
  'BLLLLLLB',
  'BBBBBBBB',
];

/** Wall with its front face. The face shows only without a wall below (step 18 picks the sprite). */
const woodenWall = pixelSprite(WOOD, [
  {
    weight: 1,
    rows: [
      ...WALL_TOP,
      'bbbBbbbb',
      'bbbBbbbb',
      'BBBBBBBB',
      'bBbbbbBb',
      'bBbbbbBb',
      'BBBBBBBB',
      'bbbBbbbb',
      'OOOOOOOO',
    ],
  },
]);

/** A closed door set in a wall, under the wall top. */
const woodenDoor = pixelSprite(WOOD, [
  {
    weight: 1,
    rows: [
      ...WALL_TOP,
      'BBBBBBBB',
      'BOOOOOOB',
      'BObbbbOB',
      'BObLLbOB',
      'BObbbyOB',
      'BObLLbOB',
      'BObbbbOB',
      'OOOOOOOO',
    ],
  },
]);

const CHARACTER: Legend = { h: P.soilDark, s: P.skin, o: P.ink, c: P.water, p: P.ink };

/** A character facing right, at rest (walk frames come with the player, step 07). */
const character = pixelSprite(CHARACTER, [
  {
    weight: 1,
    rows: [
      '..hhhh..',
      '.hhhhhh.',
      '.hhssos.',
      '..ssss..',
      '.cccccc.',
      's.cccc.s',
      '..pppp..',
      '..p..p..',
    ],
  },
]);

/** Placeholders of the objects and characters, by sprite id. */
export const OBJECT_PLACEHOLDERS: Readonly<Record<string, Placeholder>> = {
  'obj.oak_tree': oakTree,
  'obj.berry_bush': berryBush,
  'obj.tall_grass': tallGrass,
  'obj.flowers': flowers,
  'obj.wooden_wall': woodenWall,
  'obj.wooden_door': woodenDoor,
  'char.default': character,
};
