import { describe, expect, it } from 'vitest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { emptyInventory } from '../inventory/inventory';
import { type SafeZone, spawnSafeZone } from '../world/safeZone';
import { type ActionDef, type ActionSubject, type Actor, actionApplies } from './actions';
import { breakAction, cutAction, pickAction, tileTarget, uprootAction } from './harvest';

const content = loadContent(baseContent);

function tile(x: number, y: number, object?: string): ActionSubject {
  return { kind: 'tile', x, y, tiles: { ground: 'base:grass', ...(object && { object }) } };
}

function actor(x: number, y: number, extra: Partial<Actor> = {}): Actor {
  return { layer: 0, x, y, inventory: emptyInventory(), ...extra };
}

/** The harvest actions that apply to a subject. */
function applying(subject: ActionSubject): string[] {
  return [cutAction, uprootAction, pickAction, breakAction]
    .filter((action) => actionApplies(action, subject, content))
    .map((action) => action.id);
}

describe('harvest actions', () => {
  it('apply to what the tile says: cut an oak, uproot grass and flowers, pick a bush', () => {
    expect(applying(tile(1, 1, 'base:oak_tree'))).toEqual(['cut']);
    expect(applying(tile(1, 1, 'base:tall_grass'))).toEqual(['uproot']);
    expect(applying(tile(1, 1, 'base:flowers'))).toEqual(['uproot']);
    expect(applying(tile(1, 1, 'base:berry_bush'))).toEqual(['pick']);
    expect(applying(tile(1, 1, 'base:berry_bush_picked'))).toEqual([]);
    expect(applying(tile(1, 1))).toEqual([]);
    expect(applying({ kind: 'self' })).toEqual([]);
  });

  it('work on the thing that names the tile', () => {
    expect(tileTarget(tile(1, 1, 'base:oak_tree'), content)).toEqual({
      slot: 'object',
      tile: content.tiles.require('base:oak_tree'),
    });
    expect(tileTarget(tile(1, 1), content)?.slot).toBe('ground');
    expect(tileTarget({ kind: 'self' }, content)).toBeUndefined();
  });

  it('are used with the item in hand; picking takes time', () => {
    for (const action of [cutAction, uprootAction, pickAction, breakAction]) {
      expect(action.use, action.id).toBe(true);
    }
    expect(pickAction.durationMs).toBeGreaterThan(0);
    expect(cutAction.durationMs).toBeUndefined();
  });
});

describe('safe zone rule', () => {
  // A small surface (64 tiles): the spawn is at (32.5, 32.5), the zone 10 tiles around it.
  const zone: SafeZone = spawnSafeZone(64, 10);
  const check = (action: ActionDef, subject: ActionSubject, who: Actor) =>
    action.canPerform({ actor: who, subject, content, safeZone: zone });

  it('refuses to break anything in the safe zone', () => {
    const near = tile(33, 32, 'base:oak_tree');
    expect(check(cutAction, near, actor(32.5, 32.5))).toEqual({ ok: false, reason: 'safeZone' });
    expect(check(uprootAction, tile(33, 32, 'base:tall_grass'), actor(32.5, 32.5))).toEqual({
      ok: false,
      reason: 'safeZone',
    });
  });

  it('lets an admin break things there', () => {
    const near = tile(33, 32, 'base:oak_tree');
    expect(check(cutAction, near, actor(32.5, 32.5, { admin: true }))).toEqual({ ok: true });
  });

  it('allows breaking outside the zone, on another layer, or when there is no zone', () => {
    expect(check(cutAction, tile(50, 32, 'base:oak_tree'), actor(49.5, 32.5))).toEqual({
      ok: true,
    });
    const below = actor(32.5, 32.5, { layer: 1 });
    expect(check(cutAction, tile(33, 32, 'base:oak_tree'), below)).toEqual({ ok: true });
    const open = cutAction.canPerform({
      actor: actor(32.5, 32.5),
      subject: tile(33, 32, 'base:oak_tree'),
      content,
    });
    expect(open).toEqual({ ok: true });
  });

  it('allows picking berries in the zone (nothing is broken)', () => {
    expect(check(pickAction, tile(33, 32, 'base:berry_bush'), actor(32.5, 32.5))).toEqual({
      ok: true,
    });
  });
});
