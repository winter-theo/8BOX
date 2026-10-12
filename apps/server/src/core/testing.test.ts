import { CONFIG } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import type { GameModule } from './module';
import { createTestContext } from './testing';

/** Sample module: places new monsters at the origin, then makes every positioned entity drift east. */
const driftModule: GameModule = {
  id: 'drift',
  init(ctx) {
    ctx.events.on('entity.created', ({ entity, type }) => {
      if (type === 'monster' && !ctx.entities.has(entity, 'position')) {
        ctx.entities.set(entity, 'position', { layer: 0, x: 0, y: 0 });
      }
    });
    ctx.systems.add({
      name: 'drift',
      phase: 'simulate',
      run: ({ entities }, dt) => {
        for (const entity of entities.query('position')) {
          const position = entities.get(entity, 'position');
          if (position) {
            entities.set(entity, 'position', { ...position, x: position.x + 2 * dt });
          }
        }
      },
    });
  },
};

describe('createTestContext', () => {
  it('lets a module register a system and react to an event', () => {
    const { ctx, tick } = createTestContext({ modules: [driftModule] });

    const monster = ctx.entities.create('monster');
    expect(ctx.entities.get(monster, 'position')).toEqual({ layer: 0, x: 0, y: 0 });

    tick(10); // 0.5 s at 2 tiles/s

    expect(ctx.entities.get(monster, 'position')?.x).toBeCloseTo(1);
    expect(ctx.entities.near(0, 1, 0, 0.1)).toEqual([monster]);
  });

  it('runs scheduled tasks when ticking', () => {
    const { ctx, tick } = createTestContext();
    const runs: number[] = [];
    ctx.scheduler.every(100, () => runs.push(ctx.scheduler.currentTick));

    tick(6);

    expect(runs).toEqual([2, 4, 6]);
  });

  it('uses the real config and content by default, or the given ones', () => {
    const { ctx } = createTestContext();
    expect(ctx.config).toBe(CONFIG);
    expect(ctx.content.items.has('base:oak_log')).toBe(true);

    const config = { ...CONFIG, net: { ...CONFIG.net, tickRateHz: 10 } };
    const custom = createTestContext({ config });
    const durations: number[] = [];
    custom.ctx.systems.add({ name: 'dt', phase: 'input', run: (_ctx, dt) => durations.push(dt) });
    custom.tick();
    expect(durations).toEqual([0.1]);
  });
});
