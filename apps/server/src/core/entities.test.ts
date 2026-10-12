import { WORLD } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { EntityStore, type Position } from './entities';
import { createEventBus } from './events';

type TestComponents = {
  position: Position;
  health: number;
  name: string;
};

const CHUNK = WORLD.chunkSizeTiles;

function createStore() {
  const events = createEventBus();
  const store = new EntityStore<TestComponents>(events);
  return { store, events };
}

describe('EntityStore', () => {
  it('creates entities with unique ids, a type and initial components', () => {
    const { store } = createStore();

    const a = store.create('player', { health: 20, name: 'Ana' });
    const b = store.create('monster', { health: 6 });

    expect(a).not.toBe(b);
    expect(store.size).toBe(2);
    expect(store.typeOf(a)).toBe('player');
    expect(store.get(a, 'name')).toBe('Ana');
    expect(store.has(b, 'name')).toBe(false);
    expect(store.ofType('monster')).toEqual([b]);
    expect(store.countByType()).toEqual({ player: 1, monster: 1 });
  });

  it('sets, replaces and deletes components', () => {
    const { store } = createStore();
    const a = store.create('player');

    store.set(a, 'health', 20);
    store.set(a, 'health', 15);
    expect(store.get(a, 'health')).toBe(15);

    store.delete(a, 'health');
    expect(store.has(a, 'health')).toBe(false);
    expect(() => store.set(999, 'health', 1)).toThrow('unknown entity 999');
  });

  it('removes an entity with all its components', () => {
    const { store } = createStore();
    const a = store.create('player', { health: 20, position: { layer: 0, x: 1, y: 1 } });

    expect(store.remove(a)).toBe(true);
    expect(store.remove(a)).toBe(false);
    expect(store.exists(a)).toBe(false);
    expect(store.get(a, 'health')).toBeUndefined();
    expect(store.query('health')).toEqual([]);
    expect(store.inChunk({ layer: 0, cx: 0, cy: 0 }).size).toBe(0);
  });

  it('queries the entities that have every listed component', () => {
    const { store } = createStore();
    const named = store.create('player', { health: 20, name: 'Ana' });
    store.create('monster', { health: 6 });
    store.create('groundItem', { name: 'log' });

    expect(store.query('health', 'name')).toEqual([named]);
    expect(store.query('health')).toHaveLength(2);
    expect(store.query('position')).toEqual([]);
    expect(store.query()).toHaveLength(3);
  });

  it('keeps the spatial index up to date when a position changes', () => {
    const { store } = createStore();
    const a = store.create('player', { position: { layer: 0, x: 5, y: 5 } });
    const b = store.create('monster', { position: { layer: 1, x: 5, y: 5 } });

    expect([...store.inChunk({ layer: 0, cx: 0, cy: 0 })]).toEqual([a]);
    expect([...store.inChunk({ layer: 1, cx: 0, cy: 0 })]).toEqual([b]);

    store.set(a, 'position', { layer: 0, x: CHUNK + 2, y: 5 });

    expect(store.inChunk({ layer: 0, cx: 0, cy: 0 }).size).toBe(0);
    expect([...store.inChunk({ layer: 0, cx: 1, cy: 0 })]).toEqual([a]);

    store.delete(a, 'position');
    expect(store.inChunk({ layer: 0, cx: 1, cy: 0 }).size).toBe(0);
  });

  it('finds the entities near a point, across chunk borders and on one layer', () => {
    const { store } = createStore();
    const close = store.create('player', { position: { layer: 0, x: CHUNK - 1, y: 10 } });
    const acrossBorder = store.create('player', { position: { layer: 0, x: CHUNK + 1, y: 10 } });
    store.create('player', { position: { layer: 0, x: CHUNK + 10, y: 10 } });
    store.create('player', { position: { layer: 1, x: CHUNK, y: 10 } });

    expect(store.near(0, CHUNK, 10, 2).sort()).toEqual([close, acrossBorder].sort());
  });

  it('emits entity.created and entity.removed', () => {
    const { store, events } = createStore();
    const log: string[] = [];
    events.on('entity.created', ({ entity, type }) => {
      log.push(`created ${type} ${entity} health=${store.get(entity, 'health')}`);
    });
    events.on('entity.removed', ({ entity, type }) => log.push(`removed ${type} ${entity}`));

    const a = store.create('monster', { health: 6 });
    store.remove(a);

    expect(log).toEqual([`created monster ${a} health=6`, `removed monster ${a}`]);
  });
});
