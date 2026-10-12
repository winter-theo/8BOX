/**
 * Temporary game palette (PICO-8, 16 colors). The only place where in-game colors are defined:
 * replacing it restyles every placeholder.
 */
export const PALETTE = {
  black: '#000000',
  darkBlue: '#1d2b53',
  darkPurple: '#7e2553',
  darkGreen: '#008751',
  brown: '#ab5236',
  darkGray: '#5f574f',
  lightGray: '#c2c3c7',
  white: '#fff1e8',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  green: '#00e436',
  blue: '#29adff',
  lavender: '#83769c',
  pink: '#ff77a8',
  peach: '#ffccaa',
} as const;

export type PaletteColor = (typeof PALETTE)[keyof typeof PALETTE];
