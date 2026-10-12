import { describe, expect, it } from 'vitest';
import { type GameModule, sortModules } from './module';
import { createTestContext } from './testing';

function module(id: string, dependsOn: string[] = [], log: string[] = []): GameModule {
  return { id, dependsOn, init: () => log.push(id) };
}

describe('sortModules', () => {
  it('puts every module after its dependencies, keeping the given order otherwise', () => {
    const modules = [
      module('combat', ['entities', 'inventory']),
      module('chat'),
      module('inventory', ['entities']),
      module('entities'),
    ];

    expect(sortModules(modules).map((m) => m.id)).toEqual([
      'entities',
      'inventory',
      'combat',
      'chat',
    ]);
  });

  it('rejects a duplicate id, an unknown dependency and a cycle', () => {
    expect(() => sortModules([module('a'), module('a')])).toThrow('Duplicate module "a"');
    expect(() => sortModules([module('a', ['ghost'])])).toThrow(
      'Module "a" depends on unknown module "ghost"',
    );
    expect(() => sortModules([module('a', ['b']), module('b', ['c']), module('c', ['a'])])).toThrow(
      'Module dependency cycle: a → b → c → a',
    );
  });
});

describe('initModules', () => {
  it('initializes the modules in dependency order', () => {
    const log: string[] = [];

    createTestContext({
      modules: [module('crafting', ['inventory'], log), module('inventory', [], log)],
    });

    expect(log).toEqual(['inventory', 'crafting']);
  });
});

describe('SystemRegistry', () => {
  it('runs systems by phase, then order, then registration', () => {
    const { ctx, tick } = createTestContext();
    const runs: string[] = [];
    const add = (name: string, phase: 'input' | 'simulate' | 'post' | 'net', order?: number) =>
      ctx.systems.add({ name, phase, order, run: () => runs.push(name) });
    add('send', 'net');
    add('ai', 'simulate', 1);
    add('move', 'simulate');
    add('cleanup', 'post');
    add('read inputs', 'input');
    add('physics', 'simulate');

    tick();

    expect(runs).toEqual(['read inputs', 'move', 'physics', 'ai', 'cleanup', 'send']);
  });

  it('passes the tick duration in seconds', () => {
    const { ctx, tick } = createTestContext();
    const durations: number[] = [];
    ctx.systems.add({ name: 'dt', phase: 'simulate', run: (_ctx, dt) => durations.push(dt) });

    tick(2);

    expect(durations).toEqual([0.05, 0.05]);
  });

  it('keeps running the other systems when one throws', () => {
    const { ctx, tick } = createTestContext();
    const runs: string[] = [];
    ctx.systems.add({
      name: 'faulty',
      phase: 'simulate',
      run: () => {
        throw new Error('boom');
      },
    });
    ctx.systems.add({ name: 'healthy', phase: 'simulate', run: () => runs.push('healthy') });

    tick(2);

    expect(runs).toEqual(['healthy', 'healthy']);
  });
});
