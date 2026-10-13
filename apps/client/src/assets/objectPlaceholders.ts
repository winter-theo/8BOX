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

/**
 * A frame of a character skin drawn by the author, facing right (flipped to face left): its body (the
 * first 7 rows), then the feet of the frame.
 */
const skinFrame = (legend: Legend, body: readonly string[]) => (feet: string) =>
  pixelSprite(legend, [{ weight: 1, rows: [...body, feet] }]);

/** Theo: navy hair and trousers, grey shoes. */
const theoFrame = skinFrame({ o: P.black, n: P.navy, c: P.peach, g: P.slate }, [
  '..oooo..',
  '.onnnno.',
  '.onccco.',
  '.ococoo.',
  '.occcco.',
  'ocooooco',
  'oonnnnoo',
]);

/** A white cat with a rainbow collar. */
const catFrame = skinFrame(
  { o: P.black, w: P.white, p: P.pink, n: P.silver, r: P.orange, b: P.sky, y: P.yellow },
  ['.oo.oo..', '.owoowo.', '.owwwwo.', '.owowoo.', '.opwnwo.', 'owoooowo', 'oorbyroo'],
);

/** Freddy: brown, in a dark hat. */
const freddyFrame = skinFrame({ o: P.black, n: P.navy, d: P.brownDark, b: P.brown }, [
  '..oooo..',
  'oonnnnoo',
  'odoooodo',
  '.ododoo.',
  '.odbbbo.',
  'odoooodo',
  'oodbbdoo',
]);

/** The berry bush once picked: the same leaves, without berries. */
const berryBushPicked = pixelSprite(TREE, [
  {
    weight: 1,
    rows: [
      '........',
      '..kkkk..',
      '.keglek.',
      'keegeeek',
      'keeeeeek',
      'keeeegek',
      'kkeekekk',
      '.kkkkkk.',
    ],
  },
]);

/** Placeholders of the objects and characters, by sprite id. */
export const OBJECT_PLACEHOLDERS: Readonly<Record<string, Placeholder>> = {
  'obj.oak_tree': oakTree,
  'obj.berry_bush': berryBush,
  'obj.berry_bush_picked': berryBushPicked,
  'obj.tall_grass': tallGrass,
  'obj.flowers': flowers,
  'obj.wooden_wall': woodenWall,
  'obj.wooden_door': woodenDoor,
  // Only the feet move: apart at rest, then striding and together in turn.
  'char.theo.idle': theoFrame('.ogoogo.'),
  'char.theo.walk1': theoFrame('ogo..ogo'),
  'char.theo.walk2': theoFrame('..oggo..'),
  'char.cat.idle': catFrame('.owoowo.'),
  'char.cat.walk1': catFrame('owo..owo'),
  'char.cat.walk2': catFrame('..owwo..'),
  'char.freddy.idle': freddyFrame('.odoodo.'),
  'char.freddy.walk1': freddyFrame('odo..odo'),
  'char.freddy.walk2': freddyFrame('..oddo..'),
};
