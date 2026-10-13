import type { GameModule, ServerContext } from '../../core/module';
import type { Session } from '../../net/session';

/** Runs before every other system: they see the world time of this tick. */
const ADVANCE_ORDER = -1000;

function sendClock(ctx: ServerContext, session: Session): void {
  ctx.net.send(session, {
    t: 'time',
    worldTimeMs: Math.round(ctx.clock.timeMs),
    scale: ctx.clock.scale,
  });
}

/**
 * Day and night: advances the world clock every tick, whether players are there or not, and sends it
 * to each player when they arrive, then to everyone every `TIME.syncIntervalMs` (the clients run it
 * meanwhile). The persistence module saves it.
 */
export const timeModule: GameModule = {
  id: 'time',
  init(ctx) {
    /** Sessions that got the clock since they entered the world. */
    const synced = new WeakSet<Session>();

    ctx.systems.add({
      name: 'time: advance the world clock',
      phase: 'simulate',
      order: ADVANCE_ORDER,
      run: (_, dt) => ctx.clock.advance(dt * 1000),
    });

    ctx.scheduler.every(
      ctx.config.time.syncIntervalMs,
      () => {
        for (const session of ctx.net.allSessions()) {
          if (session.state === 'playing') {
            sendClock(ctx, session);
            synced.add(session);
          }
        }
      },
      'send the world clock',
    );

    ctx.systems.add({
      name: 'time: send the clock to new players',
      phase: 'net',
      run: () => {
        for (const session of ctx.net.allSessions()) {
          if (session.state === 'playing' && !synced.has(session)) {
            sendClock(ctx, session);
            synced.add(session);
          }
        }
      },
    });
  },
};
