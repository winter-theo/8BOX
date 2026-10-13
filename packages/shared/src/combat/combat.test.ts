import { describe, expect, it } from 'vitest';
import { type Actor, actionApplies } from '../actions/actions';
import { COMBAT } from '../config/combat';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { emptyInventory } from '../inventory/inventory';
import { type MovementWorld, pushMover } from '../sim/movement';
import { spawnSafeZone } from '../world/safeZone';
import {
  attackAction,
  attackReady,
  heldWeapon,
  hitZone,
  inHitZone,
  knockback,
  pvpAllowed,
} from './combat';

const content = loadContent(baseContent);

function actor(item: string | null): Actor {
  const inventory = emptyInventory();
  inventory.slots[0] = item === null ? null : { item, count: 1 };
  return { layer: 0, x: 10.5, y: 10.5, inventory };
}

describe('held weapon', () => {
  it('hits bare-handed with an empty hand, with the weapon in hand, and not with other items', () => {
    expect(heldWeapon(actor(null).inventory, content)).toEqual({ damage: 1, cooldownMs: 500 });
    const sword = heldWeapon(actor('base:wooden_sword').inventory, content);
    expect(sword).toEqual({ damage: 3, cooldownMs: 450, item: 'base:wooden_sword' });
    expect(sword?.damage).toBeGreaterThan(COMBAT.unarmedDamage);
    expect(heldWeapon(actor('base:wooden_axe').inventory, content)).toBeUndefined();
    expect(heldWeapon(actor('base:berries').inventory, content)).toBeUndefined();
  });

  it('makes the attack action apply to oneself only with a weapon or nothing in hand', () => {
    const self = { kind: 'self' } as const;
    expect(actionApplies(attackAction, self, content, actor(null))).toBe(true);
    expect(actionApplies(attackAction, self, content, actor('base:wooden_sword'))).toBe(true);
    expect(actionApplies(attackAction, self, content, actor('base:oak_log'))).toBe(false);
    const tile = { kind: 'tile' as const, x: 10, y: 10, tiles: { ground: 'base:grass' } };
    expect(actionApplies(attackAction, tile, content, actor(null))).toBe(false);
  });
});

describe('hit zone', () => {
  it('goes one tile in front of the feet, a little wider than a player', () => {
    expect(hitZone(10, 10, 'right')).toEqual({ minX: 10, maxX: 11, minY: 9.6, maxY: 10.4 });
    expect(hitZone(10, 10, 'left')).toEqual({ minX: 9, maxX: 10, minY: 9.6, maxY: 10.4 });
    expect(hitZone(10, 10, 'down')).toEqual({ minX: 9.6, maxX: 10.4, minY: 10, maxY: 11 });
    expect(hitZone(10, 10, 'up')).toEqual({ minX: 9.6, maxX: 10.4, minY: 9, maxY: 10 });
  });

  it('reaches a character standing in front, not one behind nor beside', () => {
    const right = hitZone(10, 10, 'right');
    expect(inHitZone(right, 10.7, 10)).toBe(true);
    expect(inHitZone(right, 11.2, 10.5)).toBe(true);
    expect(inHitZone(right, 9.3, 10)).toBe(false); // Behind.
    expect(inHitZone(right, 10.5, 11.2)).toBe(false); // Below.
    expect(inHitZone(right, 11.31, 10)).toBe(false); // Too far.
    const up = hitZone(10, 10, 'up');
    expect(inHitZone(up, 10, 9.3)).toBe(true);
    expect(inHitZone(up, 10, 10.7)).toBe(false);
    expect(inHitZone(up, 10.71, 9.5)).toBe(false);
  });
});

describe('cadence', () => {
  it('never lets a hit start before the cooldown of the weapon', () => {
    expect(attackReady(undefined, 0, 500)).toBe(true);
    expect(attackReady(1000, 1499, 500)).toBe(false);
    expect(attackReady(1000, 1500, 500)).toBe(true);
    expect(attackReady(1000, 1449, 450)).toBe(false);
    expect(attackReady(1000, 1450, 450)).toBe(true);
  });
});

describe('PvP', () => {
  const zone = spawnSafeZone(1024, 12);

  it('is refused when the attacker or the target stands in the safe zone', () => {
    const inside = { x: 512.5, y: 512.5 };
    const nearInside = { x: 513.5, y: 512.5 };
    const outside = { x: 540.5, y: 512.5 };
    const nearOutside = { x: 541.5, y: 512.5 };
    expect(pvpAllowed(zone, 0, inside, nearInside)).toBe(false);
    expect(pvpAllowed(zone, 0, inside, outside)).toBe(false);
    expect(pvpAllowed(zone, 0, outside, inside)).toBe(false);
    expect(pvpAllowed(zone, 0, outside, nearOutside)).toBe(true);
    expect(pvpAllowed(zone, 1, inside, nearInside)).toBe(true); // Another layer.
  });
});

describe('knockback', () => {
  const open: MovementWorld = { isSolid: () => false, speedFactor: () => 1 };

  it('pushes half a tile toward the facing of the attacker, stopped by walls', () => {
    expect(knockback('left')).toEqual({ dx: -0.5, dy: 0 });
    expect(knockback('down')).toEqual({ dx: 0, dy: 0.5 });
    const start = { x: 10.5, y: 10.5, facing: 'up' as const };
    expect(pushMover(start, 0.5, 0, open)).toEqual({ ...start, x: 11 });
    const wall: MovementWorld = { isSolid: (x) => x === 11, speedFactor: () => 1 };
    expect(pushMover(start, 0.5, 0, wall).x).toBeCloseTo(10.7);
  });
});
