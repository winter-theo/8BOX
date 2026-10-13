import { PROTOCOL_VERSION, type TimeMessage } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { WorldClock } from '../../core/clock';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { playersModule } from '../players';
import { timeModule } from './index';

function setup(clock = new WorldClock()) {
  const test = createTestContext({ devAuth: true, clock, modules: [playersModule, timeModule] });
  const ticksFor = (ms: number) => test.ctx.scheduler.ticksFor(ms);
  return { ...test, ticksFor };
}

const timeMessages = (received: readonly { t: string }[]) =>
  received.filter((message): message is TimeMessage => message.t === 'time');

describe('time module', () => {
  it('advances the world clock with the ticks, even with nobody there', () => {
    const { ctx, tick, ticksFor } = setup(new WorldClock(5000));
    tick(ticksFor(1000));
    expect(ctx.clock.timeMs).toBeCloseTo(6000);
  });

  it('runs faster with a time scale', () => {
    const { ctx, tick, ticksFor } = setup(new WorldClock(0, 60));
    tick(ticksFor(1000));
    expect(ctx.clock.timeMs).toBeCloseTo(60_000);
  });

  it('sends the clock on arrival, then every 10 s', async () => {
    const { ctx, tick, ticksFor } = setup(new WorldClock(1000, 2));
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
    await settle();
    tick();

    const [first] = timeMessages(client.received);
    expect(first).toEqual({ t: 'time', worldTimeMs: Math.round(ctx.clock.timeMs), scale: 2 });
    // Not sent again on the next ticks.
    tick(5);
    expect(timeMessages(client.received)).toHaveLength(1);

    const ticks = ticksFor(ctx.config.time.syncIntervalMs);
    for (let done = 0; done < ticks; done += 20) {
      tick(Math.min(20, ticks - done));
      ctx.net.handlePong(client.session); // A live client answers the heartbeat.
    }
    expect(timeMessages(client.received).length).toBeGreaterThanOrEqual(2);
    expect(timeMessages(client.received).at(-1)?.worldTimeMs).toBeGreaterThan(
      first?.worldTimeMs ?? 0,
    );
  });
});
