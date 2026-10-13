import { describe, expect, it } from 'vitest';
import { INTERACTION } from '../config/interaction';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import { addItems, emptyInventory, type Inventory } from '../inventory/inventory';
import {
  type ActionDef,
  ActionRegistry,
  type ActionSubject,
  type Actor,
  heldItemAction,
  listActions,
  mainAction,
  tileThing,
} from './actions';
import { baseActions, examineAction, pickUpAction } from './base';

const content = loadContent(baseContent);
const registry = new ActionRegistry(baseActions);

function actor(inventory: Inventory = emptyInventory()): Actor {
  return { layer: 0, x: 10.5, y: 10.5, inventory };
}

/** An inventory whose every slot holds a full stack of logs. */
function fullInventory(): Inventory {
  return addItems(emptyInventory(), content.items, { item: 'base:oak_log', count: 99 * 10 })
    .inventory;
}

const grass: ActionSubject = { kind: 'tile', x: 11, y: 10, tiles: { ground: 'base:grass' } };
const tree: ActionSubject = {
  kind: 'tile',
  x: 11,
  y: 10,
  tiles: { ground: 'base:grass', object: 'base:oak_tree' },
};
const apples: ActionSubject = {
  kind: 'entity',
  id: 7,
  entity: 'groundItem',
  x: 11.4,
  y: 10.6,
  item: 'base:apple',
};
const bob: ActionSubject = {
  kind: 'entity',
  id: 8,
  entity: 'player',
  x: 11.5,
  y: 10.5,
  name: 'Bob',
};

describe('ActionRegistry', () => {
  it('sorts the actions by priority, highest first', () => {
    expect(registry.all.map((action) => action.id)).toEqual(['pickUp', 'examine']);
    expect(INTERACTION.priorities.pickUp).toBeGreaterThan(INTERACTION.priorities.examine);
    expect(registry.get('pickUp')).toBe(pickUpAction);
    expect(registry.get('fly')).toBeUndefined();
  });

  it('refuses two actions with the same id', () => {
    expect(() => new ActionRegistry([examineAction, examineAction])).toThrow(/examine/);
  });
});

describe('listActions', () => {
  it('offers only the actions that apply to each subject', () => {
    const options = listActions(registry, actor(), [grass], content);
    expect(options.map((option) => option.action.id)).toEqual(['examine']);
    expect(options[0]?.target).toEqual({ kind: 'tile', x: 11, y: 10 });

    const onPlayer = listActions(registry, actor(), [bob], content);
    expect(onPlayer.map((option) => option.action.id)).toEqual(['examine']);
    expect(onPlayer[0]?.target).toEqual({ kind: 'entity', id: 8 });
  });

  it('lists the actions of every subject on the tile by priority, then subject order', () => {
    const options = listActions(registry, actor(), [tree, apples], content);
    expect(options.map((option) => [option.action.id, option.subject])).toEqual([
      ['pickUp', apples],
      ['examine', tree],
      ['examine', apples],
    ]);
    expect(options.every((option) => option.check.ok)).toBe(true);
  });

  it('keeps impossible actions, with the reason, for the menu', () => {
    const options = listActions(registry, actor(fullInventory()), [apples], content);
    expect(options.map((option) => [option.action.id, option.check])).toEqual([
      ['pickUp', { ok: false, reason: 'inventoryFull' }],
      ['examine', { ok: true }],
    ]);
  });

  it('lets a full inventory pick up an item that joins a stack with room', () => {
    let inventory = fullInventory();
    inventory = {
      ...inventory,
      slots: [{ item: 'base:apple', count: 3 }, ...inventory.slots.slice(1)],
    };
    const [pickUp] = listActions(registry, actor(inventory), [apples], content);
    expect(pickUp?.check).toEqual({ ok: true });
  });

  it('skips a tile with nothing on it (not loaded)', () => {
    const empty: ActionSubject = { kind: 'tile', x: 0, y: 0, tiles: {} };
    expect(listActions(registry, actor(), [empty], content)).toEqual([]);
  });
});

describe('mainAction and heldItemAction', () => {
  const chop: ActionDef = {
    id: 'chop',
    targets: ['tile'],
    priority: 50,
    labelKey: 'chop',
    use: true,
    appliesTo: (subject) => subject.kind === 'tile' && subject.tiles.object === 'base:oak_tree',
    canPerform: ({ actor: { inventory } }) =>
      inventory.slots[inventory.selected]?.item === 'base:stick'
        ? { ok: true }
        : { ok: false, reason: 'unavailable' },
  };
  const withChop = new ActionRegistry([...baseActions, chop]);

  it('the action key does the possible action with the highest priority', () => {
    const options = listActions(withChop, actor(), [tree, apples], content);
    expect(options[0]?.action.id).toBe('chop');
    expect(mainAction(options)?.action.id).toBe('pickUp');
    expect(
      mainAction(listActions(withChop, actor(fullInventory()), [apples], content))?.action.id,
    ).toBe('examine');
    expect(mainAction([])).toBeUndefined();
  });

  it('"use the item in hand" only picks actions marked `use`', () => {
    expect(heldItemAction(listActions(withChop, actor(), [tree, apples], content))).toBeUndefined();
    const holding = addItems(emptyInventory(), content.items, { item: 'base:stick', count: 1 });
    const options = listActions(withChop, actor(holding.inventory), [tree, apples], content);
    expect(heldItemAction(options)?.action.id).toBe('chop');
    expect(heldItemAction(listActions(registry, actor(), [tree, apples], content))).toBeUndefined();
  });
});

describe('tileThing', () => {
  it('names a tile by its object, then its floor, then its ground', () => {
    expect(tileThing({ ground: 'base:grass', object: 'base:oak_tree' })).toBe('base:oak_tree');
    expect(tileThing({ ground: 'base:grass', floor: 'base:plank' })).toBe('base:plank');
    expect(tileThing({ ground: 'base:sand' })).toBe('base:sand');
    expect(tileThing({})).toBeUndefined();
  });
});
