import type { ActionDef } from '../actions/actions';
import { COMBAT } from '../config/combat';
import { INTERACTION } from '../config/interaction';
import { PLAYER } from '../config/player';
import type { Content } from '../content/load';
import { heldStack, type Inventory } from '../inventory/inventory';
import type { Facing } from '../sim/movement';
import { inSafeZone, type SafeZone } from '../world/safeZone';

/** What a hit does with what the player holds. */
export interface Weapon {
  /** In HP. */
  damage: number;
  /** Shortest time between two hits, in ms. */
  cooldownMs: number;
  /** The weapon item (it wears with each hit that lands); none bare-handed. */
  item?: string;
}

/** An axis-aligned box, in tiles. */
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Step of one tile toward each facing. */
const FACING_VECTOR: Readonly<Record<Facing, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * How the player hits with what they hold: the weapon in hand (an item with `weapon`), or the bare hand
 * when the hand is empty; undefined when they hold something else (a tool, food, a block…).
 */
export function heldWeapon(
  inventory: Inventory,
  content: Content,
  config: Pick<typeof COMBAT, 'unarmedDamage' | 'unarmedCooldownMs'> = COMBAT,
): Weapon | undefined {
  const held = heldStack(inventory);
  if (!held) {
    return { damage: config.unarmedDamage, cooldownMs: config.unarmedCooldownMs };
  }
  const weapon = content.items.get(held.item)?.weapon;
  return weapon && { damage: weapon.damage, cooldownMs: weapon.cooldownMs, item: held.item };
}

/**
 * Where a hit lands: from the feet of the attacker, `hitRangeTiles` toward its facing, `hitWidthTiles`
 * wide across (a little wider than a player).
 */
export function hitZone(
  x: number,
  y: number,
  facing: Facing,
  config: Pick<typeof COMBAT, 'hitRangeTiles' | 'hitWidthTiles'> = COMBAT,
): Box {
  const [dx, dy] = FACING_VECTOR[facing];
  const half = config.hitWidthTiles / 2;
  const endX = x + dx * config.hitRangeTiles;
  const endY = y + dy * config.hitRangeTiles;
  return {
    minX: dx === 0 ? x - half : Math.min(x, endX),
    maxX: dx === 0 ? x + half : Math.max(x, endX),
    minY: dy === 0 ? y - half : Math.min(y, endY),
    maxY: dy === 0 ? y + half : Math.max(y, endY),
  };
}

/** Whether the box of a character with its feet at (x, y) overlaps `zone` (touching edges do not). */
export function inHitZone(
  zone: Box,
  x: number,
  y: number,
  sizeTiles: number = PLAYER.hitboxSizeTiles,
): boolean {
  const half = sizeTiles / 2;
  return (
    x + half > zone.minX && x - half < zone.maxX && y + half > zone.minY && y - half < zone.maxY
  );
}

/**
 * Whether a new hit may start at `nowMs`, the last one having started at `lastMs` (none yet when
 * undefined): never faster than the cooldown of the weapon.
 */
export function attackReady(
  lastMs: number | undefined,
  nowMs: number,
  cooldownMs: number,
): boolean {
  return lastMs === undefined || nowMs - lastMs >= cooldownMs;
}

/** The push of a hit toward the facing of the attacker, in tiles. */
export function knockback(
  facing: Facing,
  config: Pick<typeof COMBAT, 'knockbackTiles'> = COMBAT,
): { dx: number; dy: number } {
  const [dx, dy] = FACING_VECTOR[facing];
  return { dx: dx * config.knockbackTiles, dy: dy * config.knockbackTiles };
}

/**
 * Whether a player may hurt another player: not when either of them stands in the safe zone (later,
 * not in claimed land either). Feet positions, in tiles.
 */
export function pvpAllowed(
  zone: SafeZone,
  layer: number,
  attacker: { x: number; y: number },
  target: { x: number; y: number },
): boolean {
  const inZone = (p: { x: number; y: number }) =>
    inSafeZone(zone, layer, Math.floor(p.x), Math.floor(p.y));
  return !inZone(attacker) && !inZone(target);
}

/**
 * Hits in front of oneself with the weapon in hand, or bare-handed (Space, left click, Hit button):
 * aimed at oneself, the server finds what stands in the hit zone. "Use the item in hand" does it when
 * the player holds a weapon, or nothing. Performed by the combat module, which checks the cooldown of
 * the weapon.
 */
export const attackAction: ActionDef = {
  id: 'attack',
  targets: ['self'],
  priority: INTERACTION.priorities.attack,
  labelKey: 'ui.actions.attack',
  use: true,
  effort: true,
  appliesTo: (_subject, content, actor) => heldWeapon(actor.inventory, content) !== undefined,
  canPerform: () => ({ ok: true }),
};

/** The combat actions. */
export const combatActions: readonly ActionDef[] = [attackAction];
