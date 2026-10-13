/**
 * Game palette: muted, natural colors in the spirit of the author's references. The only place where
 * in-game colors are defined: changing a value restyles every placeholder sprite.
 */
export const PALETTE = {
  /** Outlines and deepest shadows. */
  ink: '#1c2a24',
  leafDark: '#2e4d34',
  leaf: '#3f6b3e',
  grassDark: '#4f8545',
  grass: '#67a052',
  grassLight: '#8cbf62',
  grassPale: '#b9da86',
  soilDark: '#523726',
  soil: '#7d5636',
  soilLight: '#a67a4b',
  sandDark: '#b89a5e',
  sand: '#d8c288',
  sandLight: '#ece0b2',
  waterDeep: '#1d3b52',
  water: '#285f75',
  waterShallow: '#3f8f91',
  waterLight: '#79c2b0',
  foam: '#dff2df',
  stone: '#6e7871',
  stoneLight: '#a8b1a4',
  bone: '#f2efdc',
  berry: '#b8433c',
  petal: '#e7c64a',
  blossom: '#d58ca4',
  skin: '#e2b48c',
  // Colors of the player skins drawn by the author.
  black: '#000000',
  white: '#ffffff',
  pink: '#ffcece',
  silver: '#bababa',
  orange: '#df7126',
  sky: '#5fcde4',
  yellow: '#fbf236',
  navy: '#222034',
  brownDark: '#663931',
  brown: '#8f563b',
} as const;

export type PaletteColor = (typeof PALETTE)[keyof typeof PALETTE];
