import { CONFIG } from '@8box/shared';
import { describe, expect, it, vi } from 'vitest';
import { createTestContext } from '../../core/testing';
import { debugModule } from './index';

const TICKS_PER_INTERVAL = CONFIG.debug.entityCountLogIntervalMs / (1000 / CONFIG.net.tickRateHz);

describe('debug module', () => {
  it('logs the number of entities every interval', () => {
    const { ctx, tick } = createTestContext({ modules: [debugModule] });
    const info = vi.spyOn(ctx.log, 'info');
    ctx.entities.create('player');
    ctx.entities.create('monster');
    ctx.entities.create('monster');

    tick(TICKS_PER_INTERVAL - 1);
    expect(info).not.toHaveBeenCalled();

    tick(1);
    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      { entities: 3, byType: { player: 1, monster: 2 } },
      'entity count',
    );

    tick(TICKS_PER_INTERVAL);
    expect(info).toHaveBeenCalledTimes(2);
  });

  it('can be disabled by config', () => {
    const config = { ...CONFIG, debug: { ...CONFIG.debug, entityCountLogEnabled: false } };
    const { ctx, tick } = createTestContext({ config, modules: [debugModule] });
    const info = vi.spyOn(ctx.log, 'info');

    tick(TICKS_PER_INTERVAL * 3);

    expect(info).not.toHaveBeenCalled();
  });
});
