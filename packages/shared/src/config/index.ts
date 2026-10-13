import { ADMIN } from './admin';
import { BUILDING } from './building';
import { CHAT } from './chat';
import { COMBAT } from './combat';
import { CRAFTING } from './crafting';
import { DEBUG } from './debug';
import { HARVEST } from './harvest';
import { INTERACTION } from './interaction';
import { INVENTORY } from './inventory';
import { LIGHT } from './light';
import { LOOP } from './loop';
import { MONSTERS } from './monsters';
import { NET } from './net';
import { PERSISTENCE } from './persistence';
import { PLAYER } from './player';
import { SURVIVAL } from './survival';
import { TIME } from './time';
import { VIEW } from './view';
import { WORLD } from './world';
import { WORLDGEN } from './worldgen';

export { DEFAULT_SKIN, isSkin, type Skin } from './player';
export { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from './units';
export {
  ADMIN,
  BUILDING,
  CHAT,
  COMBAT,
  CRAFTING,
  DEBUG,
  HARVEST,
  INTERACTION,
  INVENTORY,
  LIGHT,
  LOOP,
  MONSTERS,
  NET,
  PERSISTENCE,
  PLAYER,
  SURVIVAL,
  TIME,
  VIEW,
  WORLD,
  WORLDGEN,
};

/** Every config section, e.g. `CONFIG.player.speedTilesPerSecond` (the server context exposes it). */
export const CONFIG = {
  admin: ADMIN,
  building: BUILDING,
  chat: CHAT,
  combat: COMBAT,
  crafting: CRAFTING,
  debug: DEBUG,
  harvest: HARVEST,
  interaction: INTERACTION,
  inventory: INVENTORY,
  light: LIGHT,
  loop: LOOP,
  monsters: MONSTERS,
  net: NET,
  persistence: PERSISTENCE,
  player: PLAYER,
  survival: SURVIVAL,
  time: TIME,
  view: VIEW,
  world: WORLD,
  worldgen: WORLDGEN,
} as const;

/** Literal types widened (`20` → `number`), so another config (tests) can be passed. */
type Widen<T> = T extends boolean
  ? boolean
  : T extends number
    ? number
    : T extends string
      ? string
      : T extends RegExp
        ? RegExp
        : T extends readonly (infer U)[]
          ? readonly Widen<U>[]
          : { readonly [K in keyof T]: Widen<T[K]> };

export type GameConfig = Widen<typeof CONFIG>;
