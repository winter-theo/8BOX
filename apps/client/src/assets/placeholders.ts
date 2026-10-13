import { ITEM_PLACEHOLDERS } from './itemPlaceholders';
import { OBJECT_PLACEHOLDERS } from './objectPlaceholders';
import { PALETTE, type PaletteColor } from './palette';
import { type Legend, type Placeholder, pixelSprite } from './pixelSprite';

export type { Paint, Placeholder } from './pixelSprite';

const TILE = 8;
const P = PALETTE;

/** Variant index for any whole number (e.g. a tile hash), following the weights. */
export function pickVariant(placeholder: Placeholder, n: number): number {
  const total = placeholder.weights.reduce((sum, weight) => sum + weight, 0);
  let roll = ((Math.floor(n) % total) + total) % total;
  for (let i = 0; i < placeholder.weights.length; i++) {
    roll -= placeholder.weights[i] ?? 0;
    if (roll < 0) {
      return i;
    }
  }
  return 0;
}

const GRASS: Legend = {
  g: P.grass,
  d: P.grassDark,
  l: P.grassLight,
  p: P.grassPale,
  k: P.leafDark,
  b: P.bone,
  y: P.petal,
  s: P.stone,
  t: P.stoneLight,
};

const grass = pixelSprite(GRASS, [
  {
    weight: 6,
    rows: [
      'gggggggg',
      'gggggggg',
      'gggggdgg',
      'gggggggg',
      'glgggggg',
      'gggggggg',
      'ggggggdg',
      'gggggggg',
    ],
  },
  {
    weight: 6,
    rows: [
      'gggggggg',
      'ggdggggg',
      'gggggggg',
      'ggggglgg',
      'gggggggg',
      'gggggggg',
      'gdgggggg',
      'gggggggg',
    ],
  },
  {
    weight: 4,
    rows: [
      'gggggggg',
      'gggggggg',
      'gdldgggg',
      'ggdggggg',
      'gggggggg',
      'gggggggg',
      'ggggglgg',
      'gggggggg',
    ],
  },
  {
    weight: 4,
    rows: [
      'gggggggg',
      'gggggggg',
      'gggggggg',
      'glgggggg',
      'ggggdldg',
      'gggggdgg',
      'gggggggg',
      'gggggggg',
    ],
  },
  {
    weight: 2,
    rows: [
      'gggggggg',
      'gdldgggg',
      'ggdggggg',
      'gggggggg',
      'gggggggg',
      'ggggdldg',
      'gggggdgg',
      'gggggggg',
    ],
  },
  {
    weight: 2,
    rows: [
      'gggggggg',
      'gggggggg',
      'gggpgggg',
      'gglglggg',
      'gggggggg',
      'gggggggg',
      'ggggggdg',
      'gggggggg',
    ],
  },
  {
    weight: 1,
    rows: [
      'gggggggg',
      'gggggggg',
      'ggggpggg',
      'gggplpgg',
      'ggggpkgg',
      'gggggkgg',
      'gggggggg',
      'gggggggg',
    ],
  },
  {
    weight: 1,
    rows: [
      'gggggggg',
      'gggggggg',
      'gggggggg',
      'ggggbggg',
      'gggbybgg',
      'ggggbggg',
      'gggggkgg',
      'gggggggg',
    ],
  },
  {
    weight: 1,
    rows: [
      'gggggggg',
      'gggggggg',
      'ggyggggg',
      'ggkggggg',
      'gggggygg',
      'gggggkgg',
      'gggggggg',
      'gggggggg',
    ],
  },
  {
    weight: 1,
    rows: [
      'gggggggg',
      'gggggggg',
      'gggggggg',
      'gggggggg',
      'gggggtgg',
      'ggggtssg',
      'gggggkkg',
      'gggggggg',
    ],
  },
]);

/** Lush grass, used in patches so that meadows do not look uniform. */
const grassPatch = pixelSprite(GRASS, [
  {
    weight: 1,
    rows: [
      'dgggdggg',
      'gdgdgdgd',
      'ggdggdgg',
      'gggggggg',
      'gdgggdgg',
      'dgdgdgdg',
      'gdggggdg',
      'gggggggg',
    ],
  },
  {
    weight: 1,
    rows: [
      'gggdgggd',
      'gdgdgdgg',
      'dggdgggd',
      'gggggggg',
      'ggdgggdg',
      'gdgdgdgd',
      'ggdgggdg',
      'gggggggg',
    ],
  },
  {
    weight: 1,
    rows: [
      'gdgggdgg',
      'dgdgdgdg',
      'gggdgggd',
      'glgggggg',
      'ggggdggg',
      'gdgdgdgd',
      'dgggdggd',
      'gggggggg',
    ],
  },
]);

const DIRT: Legend = { o: P.soil, O: P.soilDark, L: P.soilLight, s: P.stone, t: P.stoneLight };

const dirt = pixelSprite(DIRT, [
  {
    weight: 5,
    rows: [
      'oooooooo',
      'ooLooooo',
      'oooooooo',
      'oooooOoo',
      'oooooooo',
      'oOoooooo',
      'ooooooLo',
      'oooooooo',
    ],
  },
  {
    weight: 5,
    rows: [
      'oooooooo',
      'ooooooOo',
      'oOoooooo',
      'oooooooo',
      'ooooLooo',
      'oooooooo',
      'ooOooooo',
      'oooooooo',
    ],
  },
  {
    weight: 2,
    rows: [
      'oooooooo',
      'oooooooo',
      'ootsoooo',
      'oossOooo',
      'ooOOoooo',
      'oooooLoo',
      'oooooooo',
      'oooooooo',
    ],
  },
  {
    weight: 2,
    rows: [
      'oooooooo',
      'ooooOooo',
      'ooooOooo',
      'oooOoooo',
      'ooOooooo',
      'ooOooooo',
      'oooooooo',
      'oooooooo',
    ],
  },
  {
    weight: 2,
    rows: [
      'oooooooo',
      'oooooooo',
      'oooooLLo',
      'oooooOOo',
      'oLoooooo',
      'oOoooooo',
      'oooooooo',
      'oooooooo',
    ],
  },
]);

const SAND: Legend = { a: P.sand, A: P.sandDark, S: P.sandLight, b: P.bone, p: P.blossom };

const sand = pixelSprite(SAND, [
  {
    weight: 5,
    rows: [
      'aaaaaaaa',
      'aAaaaaaa',
      'aaaaaSaa',
      'aaaaaaaa',
      'aaaAaaaa',
      'aaaaaaaa',
      'aSaaaaAa',
      'aaaaaaaa',
    ],
  },
  {
    weight: 5,
    rows: [
      'aaaaaaaa',
      'aaaaaAaa',
      'aSaaaaaa',
      'aaaaaaaa',
      'aaaaaaSa',
      'aaAaaaaa',
      'aaaaaaaa',
      'aaaaaaaa',
    ],
  },
  {
    weight: 3,
    rows: [
      'aaaaaaaa',
      'aaaaaaaa',
      'aSSSaaaa',
      'aAAAaaaa',
      'aaaaaaaa',
      'aaaaSSSa',
      'aaaaAAAa',
      'aaaaaaaa',
    ],
  },
  {
    weight: 1,
    rows: [
      'aaaaaaaa',
      'aaaaaaaa',
      'aaaaaaaa',
      'aaaabbaa',
      'aaabpbaa',
      'aaaaAAaa',
      'aaaaaaaa',
      'aaaaaaaa',
    ],
  },
]);

const SHALLOW: Legend = { w: P.waterShallow, W: P.water, L: P.waterLight, f: P.foam };

// Water stays calm: most tiles are plain, ripples and glints are rare.
const shallowWater = pixelSprite(SHALLOW, [
  {
    weight: 8,
    rows: [
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwWww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
    ],
  },
  {
    weight: 8,
    rows: [
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wWwwwwww',
      'wwwwwwww',
      'wwwwwwww',
    ],
  },
  {
    weight: 3,
    rows: [
      'wwwwwwww',
      'wwwwwwww',
      'wLLwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
    ],
  },
  {
    weight: 3,
    rows: [
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwLLLw',
      'wwwwwwww',
      'wwwwwwww',
    ],
  },
  {
    weight: 2,
    rows: [
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwWWwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwWWw',
      'wwwwwwww',
    ],
  },
  {
    weight: 1,
    rows: [
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwfww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
      'wwwwwwww',
    ],
  },
]);

const DEEP: Legend = { D: P.waterDeep, W: P.water, L: P.waterLight };

const deepWater = pixelSprite(DEEP, [
  {
    weight: 8,
    rows: [
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
    ],
  },
  {
    weight: 4,
    rows: [
      'DDDDDDDD',
      'DDDDDDDD',
      'DWWDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
    ],
  },
  {
    weight: 4,
    rows: [
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDWWWD',
      'DDDDDDDD',
      'DDDDDDDD',
    ],
  },
  {
    weight: 1,
    rows: [
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDLDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
      'DDDDDDDD',
    ],
  },
]);

// ─── Edges between grounds ────────────────────────────────────────────────────

/** Directions toward a neighbor tile; corners are diagonal neighbors. */
export type Side = 'n' | 'e' | 's' | 'w';
export type Corner = 'ne' | 'nw' | 'se' | 'sw';

/** Maps a pixel drawn for the north side (or the north-east corner) to the other sides. */
const SIDE_TRANSFORM: Record<Side, (x: number, y: number) => [number, number]> = {
  n: (x, y) => [x, y],
  s: (x, y) => [x, TILE - 1 - y],
  w: (x, y) => [y, x],
  e: (x, y) => [TILE - 1 - y, x],
};
const CORNER_TRANSFORM: Record<Corner, (x: number, y: number) => [number, number]> = {
  ne: (x, y) => [x, y],
  nw: (x, y) => [TILE - 1 - x, y],
  se: (x, y) => [x, TILE - 1 - y],
  sw: (x, y) => [TILE - 1 - x, TILE - 1 - y],
};

/** Bumpy rim patterns of an edge: 1 = the upper ground reaches the second row. */
const RIMS = [
  [1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 1],
] as const;

interface EdgeStyle {
  fill: PaletteColor;
  outline: PaletteColor;
}

/** The upper ground spilling over the side of a lower tile, with a bumpy outlined rim. */
function edge(style: EdgeStyle, side: Side): Placeholder {
  return {
    width: TILE,
    height: TILE,
    weights: RIMS.map(() => 1),
    draw(paint, variant) {
      const rim = RIMS[variant] ?? RIMS[0];
      const put = (x: number, y: number, color: PaletteColor) => {
        const [tx, ty] = SIDE_TRANSFORM[side](x, y);
        paint(tx, ty, color);
      };
      for (let x = 0; x < TILE; x++) {
        put(x, 0, style.fill);
        const reach = rim[x] === 1;
        if (reach) {
          put(x, 1, style.fill);
        }
        put(x, reach ? 2 : 1, style.outline);
      }
    },
  };
}

/** A small rounded nub of the upper ground in a corner of a lower tile. */
function cornerNub(style: EdgeStyle, corner: Corner): Placeholder {
  return {
    width: TILE,
    height: TILE,
    weights: [1],
    draw(paint) {
      const put = (x: number, y: number, color: PaletteColor) => {
        const [tx, ty] = CORNER_TRANSFORM[corner](x, y);
        paint(tx, ty, color);
      };
      put(6, 0, style.fill);
      put(7, 0, style.fill);
      put(7, 1, style.fill);
      put(5, 0, style.outline);
      put(6, 1, style.outline);
      put(7, 2, style.outline);
    },
  };
}

/** Foam on a water tile, a little off the shore. */
function shore(color: PaletteColor, side: Side): Placeholder {
  const spots = [
    [1, 2, 5, 6],
    [0, 3, 4, 7],
  ] as const;
  return {
    width: TILE,
    height: TILE,
    weights: spots.map(() => 1),
    draw(paint, variant) {
      for (const x of spots[variant] ?? spots[0]) {
        const [tx, ty] = SIDE_TRANSFORM[side](x, 3);
        paint(tx, ty, color);
      }
    },
  };
}

const EDGE_STYLES: Record<string, EdgeStyle> = {
  'ground.grass': { fill: P.grass, outline: P.ink },
  'ground.dirt': { fill: P.soil, outline: P.soilDark },
  'ground.sand': { fill: P.sand, outline: P.sandDark },
  'ground.shallow_water': { fill: P.waterShallow, outline: P.waterLight },
};

const SHORE_COLORS: Record<string, PaletteColor> = {
  'ground.shallow_water': P.foam,
  'ground.deep_water': P.waterLight,
};

const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];
const CORNERS: readonly Corner[] = ['ne', 'nw', 'se', 'sw'];

/** Hand-drawn placeholders by sprite id. Edges: `<ground>.edge.<side|corner>`; foam: `<water>.shore.<side>`. */
const PLACEHOLDERS: Record<string, Placeholder> = {
  'ground.grass': grass,
  'ground.grass.patch': grassPatch,
  'ground.dirt': dirt,
  'ground.sand': sand,
  'ground.shallow_water': shallowWater,
  'ground.deep_water': deepWater,
  ...OBJECT_PLACEHOLDERS,
  ...ITEM_PLACEHOLDERS,
};
for (const [id, style] of Object.entries(EDGE_STYLES)) {
  for (const side of SIDES) {
    PLACEHOLDERS[`${id}.edge.${side}`] = edge(style, side);
  }
  for (const corner of CORNERS) {
    PLACEHOLDERS[`${id}.edge.${corner}`] = cornerNub(style, corner);
  }
}
for (const [id, color] of Object.entries(SHORE_COLORS)) {
  for (const side of SIDES) {
    PLACEHOLDERS[`${id}.shore.${side}`] = shore(color, side);
  }
}

/** Drawn for a sprite id with neither an atlas frame nor a placeholder: a loud checker. */
export const MISSING_PLACEHOLDER: Placeholder = {
  width: TILE,
  height: TILE,
  weights: [1],
  draw(paint) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        paint(x, y, (x >> 2) % 2 === (y >> 2) % 2 ? P.blossom : P.ink);
      }
    }
  },
};

export function placeholderFor(spriteId: string): Placeholder | undefined {
  return PLACEHOLDERS[spriteId];
}

/** Every sprite id that has a placeholder (for the preview tool). */
export function placeholderIds(): string[] {
  return Object.keys(PLACEHOLDERS);
}
