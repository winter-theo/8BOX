/** Object probabilities of a biome: chance that a tile gets each object, from 0 to 1 (sum ≤ 1). */
interface ObjectChances {
  oak: number;
  berryBush: number;
  tallGrass: number;
  /** Only on grass. */
  flowers: number;
}

/**
 * Surface generation. Noise values go from about -1 to 1; "scale" values are the size of the noise
 * features, in tiles (bigger = wider lakes, longer rivers…).
 */
export const WORLDGEN = {
  /** Content ids used by the generator. */
  tiles: {
    grass: 'base:grass',
    dirt: 'base:dirt',
    sand: 'base:sand',
    shallowWater: 'base:shallow_water',
    deepWater: 'base:deep_water',
    oak: 'base:oak_tree',
    berryBush: 'base:berry_bush',
    tallGrass: 'base:tall_grass',
    flowers: 'base:flowers',
  },

  /** Altitude noise (lakes): feature size, in tiles. */
  altitudeScaleTiles: 160,
  /** Layers of detail added to the altitude noise. */
  altitudeOctaves: 4,
  /** Altitude below which the ground is deep water (lake centers). */
  deepWaterLevel: -0.42,
  /** Altitude below which the ground is shallow water (lake edges). */
  shallowWaterLevel: -0.3,
  /** Altitude below which the ground is sand (beaches). */
  beachLevel: -0.24,
  /** Altitude added at the spawn point, fading to 0 at `spawnLiftRadiusTiles`: keeps the spawn dry. */
  spawnLift: 0.6,
  /** Radius of the altitude lift around the spawn, in tiles. */
  spawnLiftRadiusTiles: 90,

  /** River noise: rivers follow the line where it is 0. Feature size, in tiles. */
  riverScaleTiles: 260,
  /** Half-width of a river, in noise units. */
  riverWidth: 0.022,
  /** Width of the sand banks along a river, in noise units. */
  riverBankWidth: 0.016,
  /** Rivers fade out within this distance of the spawn, in tiles. */
  riverFreeRadiusTiles: 45,

  /** Moisture noise: feature size, in tiles. */
  moistureScaleTiles: 70,
  /** Moisture below which grass gives way to dirt. */
  dirtBelowMoisture: -0.4,

  /** Wild forest noise: feature size, in tiles. */
  forestScaleTiles: 110,
  /** Forest noise above which a wild forest grows (fading in over 0.2). */
  wildForestThreshold: 0.25,
  /** Radius of the dense starting forest around the spawn, in tiles. */
  startForestRadiusTiles: 70,

  /** Object chances in a forest. */
  forest: { oak: 0.3, berryBush: 0.035, tallGrass: 0.1, flowers: 0.01 } satisfies ObjectChances,
  /** Object chances in a meadow. */
  meadow: { oak: 0.012, berryBush: 0.008, tallGrass: 0.07, flowers: 0.05 } satisfies ObjectChances,
} as const;
