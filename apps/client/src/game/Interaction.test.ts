import {
  baseContent,
  emptyInventory,
  type Facing,
  type Inventory,
  loadContent,
  type TileSlot,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { Interaction } from './Interaction';
import type { RemoteView } from './world/RemoteEntities';

const content = loadContent(baseContent);

function remote(
  view: Partial<RemoteView> & Pick<RemoteView, 'id' | 'kind' | 'x' | 'y'>,
): RemoteView {
  return {
    name: undefined,
    skin: undefined,
    item: undefined,
    creature: undefined,
    facing: 'down',
    moving: false,
    ...view,
  };
}

function setup(
  options: {
    player?: { x: number; y: number; facing: Facing };
    inventory?: Inventory | null;
    remotes?: RemoteView[];
  } = {},
) {
  const player = options.player ?? { x: 10.5, y: 10.5, facing: 'down' as Facing };
  const objects = new Map([
    ['11,10', 'base:oak_tree'],
    ['10,11', 'base:wooden_door'],
    ['9,11', 'base:wooden_door'],
  ]);
  // The door on (10, 11) is open, the one on (9, 11) closed.
  const metas = new Map([['10,11', { open: true }]]);
  const interaction = new Interaction(
    {
      player: () => ({ layer: 0, ...player }),
      inventory: () => (options.inventory === undefined ? emptyInventory() : options.inventory),
      tile: (_layer, x, y, slot: TileSlot) => {
        const id =
          slot === 'ground'
            ? 'base:grass'
            : slot === 'object'
              ? objects.get(`${x},${y}`)
              : undefined;
        return id === undefined ? undefined : content.tiles.get(id);
      },
      meta: (_layer, x, y) => metas.get(`${x},${y}`),
      remotes: () => options.remotes ?? [],
      admin: () => false,
    },
    content,
  );
  return interaction;
}

describe('Interaction aim', () => {
  it('aims at the tile in front of the player, or under the mouse when it is in reach', () => {
    const interaction = setup({ player: { x: 10.5, y: 10.5, facing: 'up' } });
    expect(interaction.aimedTile()).toEqual({ x: 10, y: 9 });

    interaction.setPointerTile({ x: 11, y: 11 });
    expect(interaction.aimedTile()).toEqual({ x: 11, y: 11 });

    interaction.setPointerTile({ x: 14, y: 10 });
    expect(interaction.aimedTile()).toEqual({ x: 10, y: 9 });
    expect(interaction.inReach(14, 10)).toBe(false);
    expect(interaction.inReach(9, 9)).toBe(true);

    interaction.setPointerTile(undefined);
    expect(interaction.aimedTile()).toEqual({ x: 10, y: 9 });
  });
});

describe('Interaction subjects and options', () => {
  const apples = remote({ id: 7, kind: 'groundItem', x: 11.3, y: 10.8, item: 'base:apple' });
  const bob = remote({ id: 8, kind: 'player', x: 11.6, y: 10.4, name: 'Bob' });
  const far = remote({ id: 9, kind: 'groundItem', x: 12.5, y: 10.5, item: 'base:stick' });

  it('lists the tile, then the entities standing on it', () => {
    const interaction = setup({ remotes: [apples, bob, far] });
    expect(interaction.subjectsAt(11, 10)).toEqual([
      { kind: 'tile', x: 11, y: 10, tiles: { ground: 'base:grass', object: 'base:oak_tree' } },
      { kind: 'entity', id: 7, entity: 'groundItem', x: 11.3, y: 10.8, item: 'base:apple' },
      { kind: 'entity', id: 8, entity: 'player', x: 11.6, y: 10.4, name: 'Bob' },
    ]);
    // The player's own tile also offers actions on themselves.
    expect(interaction.subjectsAt(10, 10).map((subject) => subject.kind)).toEqual(['tile', 'self']);
  });

  it('offers picking up first, then examining, with the reason when it is impossible', () => {
    const interaction = setup({ remotes: [apples] });
    expect(
      interaction
        .optionsAt(11, 10)
        .map((option) => [option.action.id, option.target, option.check]),
    ).toEqual([
      ['pickUp', { kind: 'entity', id: 7 }, { ok: true }],
      ['cut', { kind: 'tile', x: 11, y: 10 }, { ok: true }],
      ['examine', { kind: 'tile', x: 11, y: 10 }, { ok: true }],
      ['examine', { kind: 'entity', id: 7 }, { ok: true }],
    ]);

    const slots = Array.from({ length: 10 }, () => ({ item: 'base:oak_log', count: 99 }));
    const full = setup({ remotes: [apples], inventory: { ...emptyInventory(), slots } });
    expect(full.optionsAt(11, 10)[0]?.check).toEqual({ ok: false, reason: 'inventoryFull' });
  });

  it('opens a closed door and closes an open one, from the state the chunks have', () => {
    const interaction = setup();
    const ids = (x: number, y: number) =>
      interaction.optionsAt(x, y).map((option) => option.action.id);
    expect(interaction.subjectsAt(10, 11)[0]).toMatchObject({ meta: { open: true } });
    expect(ids(10, 11)).toEqual(['closeDoor', 'break', 'examine']);
    expect(ids(9, 11)).toEqual(['openDoor', 'break', 'examine']);
  });
  it('offers nothing before the inventory arrives', () => {
    expect(setup({ inventory: null }).optionsAt(11, 10)).toEqual([]);
  });
});
