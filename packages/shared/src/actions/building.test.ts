import { describe, expect, it } from 'vitest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import type { TileSlot } from '../content/schemas';
import { emptyInventory, type Inventory } from '../inventory/inventory';
import type { TileMeta } from '../world/chunk';
import { spawnSafeZone } from '../world/safeZone';
import { type ActionSubject, type Actor, actionApplies } from './actions';
import {
  boxOverlapsTile,
  closeDoorAction,
  openDoorAction,
  placeAction,
  sleepAction,
} from './building';

const content = loadContent(baseContent);
// A small surface (64 tiles): the spawn is at (32.5, 32.5), the safe zone 10 tiles around it.
const safeZone = spawnSafeZone(64, 10);

function holding(item: string | null): Inventory {
  const inventory = emptyInventory();
  inventory.slots[0] = item === null ? null : { item, count: 3 };
  return inventory;
}

function actor(x: number, y: number, item: string | null, admin = false): Actor {
  return { layer: 0, x, y, inventory: holding(item), admin };
}

function tile(x: number, y: number, tiles: Partial<Record<TileSlot, string>> = {}): ActionSubject {
  return { kind: 'tile', x, y, tiles: { ground: 'base:grass', ...tiles } };
}

const check = (who: Actor, subject: ActionSubject) =>
  placeAction.canPerform({ actor: who, subject, content, safeZone });

describe('place action', () => {
  it('applies only while holding an item that is placed', () => {
    expect(actionApplies(placeAction, tile(2, 2), content, actor(2.5, 3.5, 'base:workbench'))).toBe(
      true,
    );
    expect(actionApplies(placeAction, tile(2, 2), content, actor(2.5, 3.5, 'base:oak_log'))).toBe(
      false,
    );
    expect(actionApplies(placeAction, tile(2, 2), content, actor(2.5, 3.5, null))).toBe(false);
    expect(
      actionApplies(placeAction, { kind: 'self' }, content, actor(2.5, 3.5, 'base:torch')),
    ).toBe(false);
    expect(placeAction.use).toBe(true);
  });

  it('places on a free tile outside the safe zone', () => {
    expect(check(actor(2.5, 3.5, 'base:workbench'), tile(2, 2))).toEqual({ ok: true });
    expect(check(actor(2.5, 3.5, 'base:wooden_floor'), tile(2, 2))).toEqual({ ok: true });
  });

  it('refuses a tile that holds an object, the same floor, or deep water', () => {
    const workbench = actor(2.5, 3.5, 'base:workbench');
    expect(check(workbench, tile(2, 2, { object: 'base:tall_grass' }))).toEqual({
      ok: false,
      reason: 'occupied',
    });
    expect(check(workbench, tile(2, 2, { ground: 'base:deep_water' })).ok).toBe(false);
    expect(check(workbench, tile(2, 2, { floor: 'base:wooden_floor' }))).toEqual({ ok: true });
    const floor = actor(2.5, 3.5, 'base:wooden_floor');
    expect(check(floor, tile(2, 2, { floor: 'base:wooden_floor' })).ok).toBe(false);
    expect(check(floor, tile(2, 2, { object: 'base:oak_tree' })).ok).toBe(false);
  });

  it('never places a solid object on the player, but a floor or a torch may go under them', () => {
    expect(check(actor(2.5, 2.5, 'base:workbench'), tile(2, 2))).toEqual({
      ok: false,
      reason: 'occupied',
    });
    // The box (0.6 tiles) overlaps the tile above the feet.
    expect(check(actor(2.5, 3.2, 'base:workbench'), tile(2, 2)).ok).toBe(false);
    expect(check(actor(2.5, 3.3, 'base:workbench'), tile(2, 2)).ok).toBe(true);
    expect(check(actor(2.5, 2.5, 'base:wooden_floor'), tile(2, 2)).ok).toBe(true);
    expect(check(actor(2.5, 2.5, 'base:torch'), tile(2, 2)).ok).toBe(true);
  });

  it('builds nothing in the safe zone, except for an admin', () => {
    expect(check(actor(32.5, 33.5, 'base:workbench'), tile(32, 32))).toEqual({
      ok: false,
      reason: 'safeZone',
    });
    expect(check(actor(32.5, 33.5, 'base:workbench', true), tile(32, 32)).ok).toBe(true);
  });
});

describe('boxOverlapsTile', () => {
  it('does not count a box flush against the tile', () => {
    expect(boxOverlapsTile({ x: 1.7, y: 0.5 }, 0.3, 2, 0)).toBe(false);
    expect(boxOverlapsTile({ x: 1.71, y: 0.5 }, 0.3, 2, 0)).toBe(true);
  });
});

describe('door actions', () => {
  const door = (meta?: TileMeta): ActionSubject => ({
    ...tile(2, 2, { object: 'base:wooden_door' }),
    ...(meta && { meta }),
  });
  const someone = actor(2.5, 3.5, null);
  const applies = (subject: ActionSubject) =>
    [openDoorAction, closeDoorAction].filter((action) =>
      actionApplies(action, subject, content, someone),
    );

  it('opens a closed door and closes an open one', () => {
    expect(applies(door())).toEqual([openDoorAction]);
    expect(applies(door({ open: true }))).toEqual([closeDoorAction]);
    expect(applies(tile(2, 2, { object: 'base:wooden_wall' }))).toEqual([]);
    expect(openDoorAction.canPerform({ actor: someone, subject: door(), content })).toEqual({
      ok: true,
    });
  });

  it('does not close a door on the player standing in the doorway', () => {
    const open = door({ open: true });
    expect(closeDoorAction.canPerform({ actor: someone, subject: open, content })).toEqual({
      ok: true,
    });
    expect(
      closeDoorAction.canPerform({ actor: actor(2.5, 2.5, null), subject: open, content }),
    ).toEqual({ ok: false, reason: 'occupied' });
  });
});

describe('sleep action', () => {
  it('applies to a bed, in the safe zone too', () => {
    const bed = tile(32, 32, { object: 'base:bed' });
    const sleeper = actor(32.5, 33.5, null);
    expect(actionApplies(sleepAction, bed, content, sleeper)).toBe(true);
    expect(sleepAction.canPerform({ actor: sleeper, subject: bed, content, safeZone })).toEqual({
      ok: true,
    });
    expect(
      actionApplies(sleepAction, tile(2, 2, { object: 'base:workbench' }), content, sleeper),
    ).toBe(false);
  });
});
