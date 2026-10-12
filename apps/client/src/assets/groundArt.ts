import { hashCoords } from '@8box/shared';
import type { Corner, Side } from './placeholders';

/** A sprite to draw on a tile, in order; `variant` is any whole number. */
export interface SpriteDraw {
  sprite: string;
  variant: number;
}

/** Sprite ids of the ground and floor at a tile; undefined when the tile is not known (not loaded). */
export type GroundLookup = (
  x: number,
  y: number,
) => { ground: string | undefined; floor: string | undefined } | undefined;

/**
 * Stacking order of the natural grounds: a higher ground spills over a lower neighbor with an outlined
 * edge (grass over dirt, dirt over sand, sand over water…). Grounds missing here get no edge.
 */
const GROUND_RANK: Readonly<Record<string, number>> = {
  'ground.deep_water': 0,
  'ground.shallow_water': 1,
  'ground.sand': 2,
  'ground.dirt': 3,
  'ground.grass': 4,
};
/** Grounds at or below this rank are water: they get foam along the shore. */
const WATER_MAX_RANK = 1;

/** Grounds with a `.patch` sprite, used in patches (lush grass…), and how patches are spread. */
const PATCHED = new Set(['ground.grass']);
/** Size of the patches, in tiles. */
const PATCH_SCALE_TILES = 6;
/** Share of the noise range above which a tile is in a patch (0.6 ≈ a fifth of the area). */
const PATCH_THRESHOLD = 0.6;

/** Seeds that decorrelate the random choices of a tile (variants, edges, patches). */
const SALT = { base: 0x6b1d, edge: 0x2c77, shore: 0x51f3, patch: 0x9e2a } as const;
/** Range of the variant numbers drawn from a tile hash. */
const VARIANT_RANGE = 1 << 16;

const SIDE_OFFSETS: Readonly<Record<Side, readonly [number, number]>> = {
  n: [0, -1],
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
};
const CORNER_OFFSETS: Readonly<Record<Corner, readonly [number, number, Side, Side]>> = {
  ne: [1, -1, 'n', 'e'],
  nw: [-1, -1, 'n', 'w'],
  se: [1, 1, 's', 'e'],
  sw: [-1, 1, 's', 'w'],
};

function variantAt(salt: number, x: number, y: number): number {
  return Math.floor(hashCoords(salt, x, y) * VARIANT_RANGE);
}

/** Smooth value noise in [0, 1): random values on a grid, blended in between. */
function valueNoise(salt: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const top = hashCoords(salt, x0, y0) * (1 - tx) + hashCoords(salt, x0 + 1, y0) * tx;
  const bottom = hashCoords(salt, x0, y0 + 1) * (1 - tx) + hashCoords(salt, x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * Sprites to draw for one tile, bottom to top: its ground (or a patch of it), the edges of higher
 * neighbors spilling over it (with foam on water), then its floor. Pure: the renderer and the preview
 * tool both use it.
 */
export function planGroundTile(x: number, y: number, lookup: GroundLookup): SpriteDraw[] {
  const here = lookup(x, y);
  const ground = here?.ground;
  if (!ground) {
    return [];
  }
  const inPatch =
    PATCHED.has(ground) &&
    valueNoise(SALT.patch, x / PATCH_SCALE_TILES, y / PATCH_SCALE_TILES) > PATCH_THRESHOLD;
  const draws: SpriteDraw[] = [
    { sprite: inPatch ? `${ground}.patch` : ground, variant: variantAt(SALT.base, x, y) },
  ];

  const rank = GROUND_RANK[ground];
  if (rank !== undefined) {
    const rankAt = (dx: number, dy: number) => {
      const neighbor = lookup(x + dx, y + dy)?.ground;
      return neighbor === undefined
        ? undefined
        : { id: neighbor, rank: GROUND_RANK[neighbor] ?? -1 };
    };
    const overlays: { rank: number; draws: SpriteDraw[] }[] = [];
    const higherSides = new Set<Side>();
    for (const [side, [dx, dy]] of Object.entries(SIDE_OFFSETS) as [
      Side,
      readonly [number, number],
    ][]) {
      const neighbor = rankAt(dx, dy);
      if (!neighbor || neighbor.rank <= rank) {
        continue;
      }
      higherSides.add(side);
      const sideDraws: SpriteDraw[] = [];
      if (rank <= WATER_MAX_RANK && neighbor.rank > WATER_MAX_RANK) {
        sideDraws.push({ sprite: `${ground}.shore.${side}`, variant: variantAt(SALT.shore, x, y) });
      }
      sideDraws.push({
        sprite: `${neighbor.id}.edge.${side}`,
        variant: variantAt(SALT.edge, x, y),
      });
      overlays.push({ rank: neighbor.rank, draws: sideDraws });
    }
    for (const [corner, [dx, dy, sideA, sideB]] of Object.entries(CORNER_OFFSETS) as [
      Corner,
      readonly [number, number, Side, Side],
    ][]) {
      const neighbor = rankAt(dx, dy);
      if (!neighbor || neighbor.rank <= rank || higherSides.has(sideA) || higherSides.has(sideB)) {
        continue;
      }
      overlays.push({
        rank: neighbor.rank,
        draws: [{ sprite: `${neighbor.id}.edge.${corner}`, variant: 0 }],
      });
    }
    // Lower grounds first, so that the highest edge ends on top.
    overlays.sort((a, b) => a.rank - b.rank);
    for (const overlay of overlays) {
      draws.push(...overlay.draws);
    }
  }

  if (here.floor) {
    draws.push({ sprite: here.floor, variant: variantAt(SALT.base, x, y) });
  }
  return draws;
}
