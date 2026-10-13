import { describe, expect, it } from 'vitest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { emptyInventory } from '../inventory/inventory';
import { type Actor, actionApplies } from './actions';
import { eatAction, heldFood } from './survival';

const content = loadContent(baseContent);

function actor(item: string | null, hunger?: number): Actor {
  const inventory = emptyInventory();
  inventory.slots[0] = item === null ? null : { item, count: 3 };
  return { layer: 0, x: 1.5, y: 1.5, inventory, ...(hunger !== undefined && { hunger }) };
}

describe('eat action', () => {
  it('applies to oneself with food in hand', () => {
    expect(heldFood(actor('base:berries').inventory, content)).toEqual({
      item: 'base:berries',
      hunger: 2,
    });
    expect(heldFood(actor('base:apple').inventory, content)).toEqual({
      item: 'base:apple',
      hunger: 4,
    });
    expect(actionApplies(eatAction, { kind: 'self' }, content, actor('base:berries'))).toBe(true);
    expect(actionApplies(eatAction, { kind: 'self' }, content, actor('base:oak_log'))).toBe(false);
    expect(actionApplies(eatAction, { kind: 'self' }, content, actor(null))).toBe(false);
    const tile = { kind: 'tile' as const, x: 1, y: 1, tiles: { ground: 'base:grass' } };
    expect(actionApplies(eatAction, tile, content, actor('base:berries'))).toBe(false);
  });

  it('is refused with a full stomach', () => {
    const check = (hunger: number) =>
      eatAction.canPerform({
        actor: actor('base:apple', hunger),
        subject: { kind: 'self' },
        content,
      });
    expect(check(19)).toEqual({ ok: true });
    expect(check(20)).toEqual({ ok: false, reason: 'full' });
  });
});
