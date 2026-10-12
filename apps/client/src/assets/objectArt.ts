import { hashCoords } from '@8box/shared';

/** Seed that decorrelates the object variants from the ground ones. */
const OBJECT_SALT = 0x4f1b;
/** Range of the variant numbers drawn from a tile hash. */
const VARIANT_RANGE = 1 << 16;

/** Variant number of the object on tile (x, y): stable, so a redrawn tree keeps its look. */
export function objectVariant(x: number, y: number): number {
  return Math.floor(hashCoords(OBJECT_SALT, x, y) * VARIANT_RANGE);
}
