import type { GameModule } from '../../core/module';

/** Logs the number of entities periodically (`config.debug`). */
export const debugModule: GameModule = {
  id: 'debug',
  init(ctx) {
    const { entityCountLogEnabled, entityCountLogIntervalMs } = ctx.config.debug;
    if (!entityCountLogEnabled) {
      return;
    }
    ctx.scheduler.every(
      entityCountLogIntervalMs,
      () => {
        ctx.log.info(
          { entities: ctx.entities.size, byType: ctx.entities.countByType() },
          'entity count',
        );
      },
      'debug: entity count',
    );
  },
};
