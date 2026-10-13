import { PALETTE } from './palette';
import { type Legend, type Placeholder, pixelSprite } from './pixelSprite';
import { SIDE_BITS, WALL_MASKS, wallSpriteId } from './wallArt';

/** Size of a tile, in pixels. */
const TILE_PX = 8;

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

/** Grain of the top of a wall seen from above, row by row ('b' = darker wood), every 8 rows. */
const WALL_GRAIN = [
  '........',
  '........',
  '...b....',
  '........',
  '.....b..',
  '..b.....',
  '........',
  '........',
];

/** Front face of a wall: planks, its foot in shadow. */
const WALL_FACE = [
  'bbbBbbbb',
  'bbbBbbbb',
  'BBBBBBBB',
  'bBbbbbBb',
  'bBbbbbBb',
  'BBBBBBBB',
  'bbbBbbbb',
  'OOOOOOOO',
];

/**
 * A wooden wall joined to its neighbors on the sides of `mask` (`SIDE_BITS`), 8 × 16. Its top, seen from
 * above, covers the tile above the wall and is edged on the sides where nothing joins; with a wall below,
 * the top goes on down to the next wall, otherwise the front face shows.
 */
function woodenWall(mask: number): Placeholder {
  const joined = (side: keyof typeof SIDE_BITS) => (mask & SIDE_BITS[side]) !== 0;
  const topRows = joined('s') ? 2 * TILE_PX : TILE_PX;
  return {
    width: TILE_PX,
    height: 2 * TILE_PX,
    weights: [1],
    draw(paint) {
      for (let y = 0; y < 2 * TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
          const sideEdge = (x === 0 && !joined('w')) || (x === TILE_PX - 1 && !joined('e'));
          if (y < topRows) {
            const edge =
              sideEdge || (y === 0 && !joined('n')) || (y === topRows - 1 && !joined('s'));
            const grain = WALL_GRAIN[y % TILE_PX]?.[x] === 'b';
            paint(x, y, edge ? P.soilDark : grain ? P.soil : P.soilLight);
          } else {
            const face = WALL_FACE[y - TILE_PX]?.[x] ?? 'b';
            paint(x, y, face === 'O' ? P.ink : sideEdge || face === 'B' ? P.soilDark : P.soil);
          }
        }
      }
    },
  };
}

/** Top of a door seen from above: like a wall top, open on its sides (doors sit in wall lines). */
const DOOR_TOP = [
  'BBBBBBBB',
  'LLLLLLLL',
  'LLLbLLLL',
  'LLLLLLLL',
  'LLLLLbLL',
  'LbLLLLLL',
  'LLLLLLLL',
  'BBBBBBBB',
];

/** A closed door set in a wall, under the top of the wall. */
const woodenDoor = pixelSprite(WOOD, [
  {
    weight: 1,
    rows: [
      ...DOOR_TOP,
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

/** An open door: the doorway shows the ground, the door folded against its left post. */
const woodenDoorOpen = pixelSprite(WOOD, [
  {
    weight: 1,
    rows: [
      ...DOOR_TOP,
      'BBBBBBBB',
      'BbO....B',
      'BLO....B',
      'BbO....B',
      'ByO....B',
      'BLO....B',
      'BbO....B',
      'OOO....O',
    ],
  },
]);

/** The wooden wall joined every way (`obj.wooden_wall.<sides>`), and alone (`obj.wooden_wall`). */
const WOODEN_WALLS: Record<string, Placeholder> = { 'obj.wooden_wall': woodenWall(0) };
for (let mask = 0; mask < WALL_MASKS; mask++) {
  WOODEN_WALLS[wallSpriteId('obj.wooden_wall', mask)] = woodenWall(mask);
}

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

const FURNITURE: Legend = {
  o: P.ink,
  d: P.soilDark,
  b: P.soil,
  l: P.soilLight,
  w: P.bone,
  r: P.berry,
  p: P.petal,
};

const furniture = (rows: readonly string[]) => pixelSprite(FURNITURE, [{ weight: 1, rows }]);

/** A workbench: a thick top on four legs. */
const workbench = furniture([
  '........',
  'oooooooo',
  'olllllwo',
  'olbllllo',
  'obbbbbbo',
  'oooooooo',
  'od.oo.do',
  'oo....oo',
]);

/** A torch stuck in the ground. */
const torch = furniture([
  '........',
  '....p...',
  '...prp..',
  '...rpr..',
  '....d...',
  '....d...',
  '....d...',
  '...ddd..',
]);

/** A bed seen from above: the pillow at the top. */
const bed = furniture([
  'oooooooo',
  'owwwwwwo',
  'owwwwwwo',
  'orrrrrro',
  'orrrrrro',
  'orrrrrro',
  'oddddddo',
  'od....do',
]);

/** Wooden floor planks, covering the whole tile (drawn over the ground). */
const woodenFloor = pixelSprite(WOOD, [
  {
    weight: 1,
    rows: [
      'bbbbBbbb',
      'LLLLBLLL',
      'bbbbBbbb',
      'BBBBBBBB',
      'bbBbbbbb',
      'LLBLLLLL',
      'bbBbbbbb',
      'BBBBBBBB',
    ],
  },
]);

/** Roof shingles, covering a whole tile of a room (drawn one tile higher, on top of the walls). */
const roof = pixelSprite({ d: P.brownDark, b: P.brown, o: P.ink }, [
  {
    weight: 1,
    rows: [
      'bbbdbbbb',
      'bbbdbbbb',
      'dddddddd',
      'bbbbbbbd',
      'bbbbbbbd',
      'dddddddd',
      'bdbbbbbb',
      'odoooooo',
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
  ...WOODEN_WALLS,
  'obj.wooden_door': woodenDoor,
  'obj.wooden_door.open': woodenDoorOpen,
  'obj.workbench': workbench,
  'obj.torch': torch,
  'obj.bed': bed,
  'floor.wooden_floor': woodenFloor,
  'roof.default': roof,
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
