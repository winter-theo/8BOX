import { type ClientMessage, CONFIG, encodeMessage, PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import type { GameModule } from '../core/module';
import { connectFakeClient, createTestContext, settle } from '../core/testing';
import { CloseCode } from './net';

/** Minimal join: gives every authenticated session a player entity. */
const joinModule: GameModule = {
  id: 'test-join',
  init(ctx) {
    ctx.events.on('session.authenticated', ({ session }) => {
      const entity = ctx.entities.create('player');
      session.player = { entity, name: session.name ?? '?', skin: 'theo', position: SPAWN };
    });
  },
};

const SPAWN = { layer: 0, x: 0.5, y: 0.5 };
const TICK_MS = 1000 / CONFIG.net.tickRateHz;
/** Encodes any object, valid or not, as a client would. */
const raw = (message: unknown) => encodeMessage(message as ClientMessage);
const hello = (devName?: string, version = PROTOCOL_VERSION) =>
  ({ t: 'hello', version, devName }) as const;

function setup(options: { devAuth?: boolean; modules?: GameModule[] } = {}) {
  const clock = { now: 0 };
  const test = createTestContext({
    devAuth: options.devAuth ?? true,
    modules: options.modules ?? [joinModule],
    now: () => clock.now,
  });
  return { ...test, clock, connect: () => connectFakeClient(test.ctx) };
}

describe('NetServer handshake', () => {
  it('welcomes a valid dev hello and marks the session as playing', async () => {
    const { ctx, connect } = setup();
    const client = connect();

    client.send(hello('Ana'));

    await settle();

    expect(client.last()).toMatchObject({ t: 'welcome', you: { name: 'Ana' } });
    expect(client.session.state).toBe('playing');
    expect(ctx.entities.exists(client.session.player?.entity ?? -1)).toBe(true);
  });

  it('rejects another protocol version as outdated', async () => {
    const { connect } = setup();
    const client = connect();

    client.send(hello('Ana', PROTOCOL_VERSION + 1));

    await settle();

    expect(client.received).toEqual([{ t: 'rejected', reason: 'outdated' }]);
    expect(client.closed?.code).toBe(CloseCode.normal);
    expect(client.session.state).toBe('closed');
  });

  it('rejects dev logins when the dev mode is off', async () => {
    const { connect } = setup({ devAuth: false });
    const client = connect();

    client.send(hello('Ana'));

    await settle();

    expect(client.received).toEqual([{ t: 'rejected', reason: 'devAuthDisabled' }]);
  });

  it('rejects a hello without a token or a dev name, and an invalid dev name', async () => {
    const { connect } = setup();
    const nothing = connect();
    const badName = connect();

    nothing.send(hello());
    badName.send(hello('a b'));
    await settle();

    expect(nothing.last()).toEqual({ t: 'rejected', reason: 'invalidToken' });
    expect(badName.last()).toEqual({ t: 'rejected', reason: 'invalidName' });
  });

  it('rejects the session when no module spawns the player', async () => {
    const { connect } = setup({ modules: [] });
    const client = connect();

    client.send(hello('Ana'));

    await settle();

    expect(client.last()).toEqual({ t: 'rejected', reason: 'unavailable' });
  });

  it('replaces an older session that uses the same name', async () => {
    const { ctx, connect } = setup();
    const first = connect();
    const second = connect();

    first.send(hello('Ana'));

    await settle();
    second.send(hello('ana'));
    await settle();

    expect(first.last()).toEqual({ t: 'rejected', reason: 'replaced' });
    expect(first.session.state).toBe('closed');
    expect(second.last()).toMatchObject({ t: 'welcome' });
    expect(ctx.net.sessionCount).toBe(1);
  });

  it('closes a connection that sends no hello in time', async () => {
    const { ctx, tick, connect } = setup();
    const client = connect();

    // A live client answers every heartbeat, but never says hello.
    for (let t = 1; t < CONFIG.net.helloTimeoutMs / TICK_MS; t++) {
      tick();
      ctx.net.handlePong(client.session);
    }
    expect(client.closed).toBeUndefined();
    tick();

    expect(client.closed).toEqual({ code: CloseCode.policyViolation, reason: 'no hello in time' });
  });

  it('ignores a second hello', async () => {
    const { connect } = setup();
    const client = connect();
    client.send(hello('Ana'));
    await settle();

    client.send(hello('Bob'));

    await settle();

    expect(client.received).toHaveLength(1);
    expect(client.session.name).toBe('Ana');
  });
});

describe('NetServer messages', () => {
  it('answers ping with pong, even before joining', async () => {
    const { connect } = setup();
    const client = connect();

    client.send({ t: 'ping', time: 42.5 });

    expect(client.last()).toEqual({ t: 'pong', time: 42.5 });
  });

  it('ignores invalid messages without crashing and keeps the session', async () => {
    const { connect } = setup();
    const client = connect();

    client.sendRaw(new Uint8Array([0xc1, 0x00]));
    client.sendRaw(raw({ t: 'teleport', x: 9 }));
    client.sendRaw(raw({ t: 'ping', time: 'now' }));
    client.sendRaw(new TextEncoder().encode('ping'), false);

    expect(client.received).toEqual([]);
    expect(client.closed).toBeUndefined();
    client.send({ t: 'ping', time: 1 });
    expect(client.last()).toEqual({ t: 'pong', time: 1 });
  });

  it('dispatches game messages to their handler only once joined', async () => {
    const { ctx, connect } = setup();
    const inputs: number[] = [];
    ctx.net.onMessage('input', (session) => inputs.push(session.id));
    const client = connect();

    client.send({ t: 'input', seq: 0, dir: 0 });
    client.send(hello('Ana'));
    await settle();
    client.send({ t: 'input', seq: 0, dir: 0 });

    expect(inputs).toEqual([client.session.id]);
  });

  it('survives a handler that throws', async () => {
    const { ctx, connect } = setup();
    ctx.net.onMessage('input', () => {
      throw new Error('boom');
    });
    const client = connect();
    client.send(hello('Ana'));
    await settle();

    expect(() => client.send({ t: 'input', seq: 0, dir: 0 })).not.toThrow();
    expect(client.session.state).toBe('playing');
  });

  it('ignores messages over the rate limit, then accepts them again', async () => {
    const { ctx, clock, connect } = setup();
    let inputs = 0;
    ctx.net.onMessage('input', () => {
      inputs++;
    });
    const client = connect();
    client.send(hello('Ana'));
    await settle();
    const { max, windowMs } = CONFIG.net.rateLimits.input;

    for (let i = 0; i < max + 10; i++) {
      client.send({ t: 'input', seq: 0, dir: 0 });
    }
    expect(inputs).toBe(max);

    clock.now += windowMs;
    client.send({ t: 'input', seq: 0, dir: 0 });
    expect(inputs).toBe(max + 1);
    expect(client.closed).toBeUndefined();
  });

  it('disconnects a client that keeps sending ignored messages', async () => {
    const { connect } = setup();
    const client = connect();

    for (let i = 0; i <= CONFIG.net.maxViolations; i++) {
      client.sendRaw(new Uint8Array([0xc1]));
    }

    expect(client.closed).toEqual({
      code: CloseCode.policyViolation,
      reason: 'too many invalid messages',
    });
  });
});

describe('NetServer heartbeat and closing', () => {
  const HEARTBEAT_TICKS = CONFIG.net.heartbeatIntervalMs / TICK_MS;

  it('measures the latency and drops a connection that stops answering', async () => {
    const { ctx, clock, tick, connect } = setup();
    const client = connect();
    client.send(hello('Ana'));
    await settle();

    tick(HEARTBEAT_TICKS);
    expect(client.pings).toBe(1);
    clock.now += 30;
    ctx.net.handlePong(client.session);
    expect(client.session.latencyMs).toBe(30);

    tick(HEARTBEAT_TICKS); // answered: pinged again
    expect(client.pings).toBe(2);
    tick(HEARTBEAT_TICKS); // not answered: dropped
    expect(client.closed).toEqual({ code: CloseCode.goingAway, reason: 'heartbeat timeout' });
  });

  it('emits session.closed once when the client leaves', async () => {
    const { ctx, connect } = setup();
    const reasons: string[] = [];
    ctx.events.on('session.closed', ({ reason }) => reasons.push(reason));
    const client = connect();
    client.send(hello('Ana'));
    await settle();

    ctx.net.handleClose(client.session);
    ctx.net.handleClose(client.session);

    expect(reasons).toEqual(['connection closed']);
    expect(ctx.net.sessionCount).toBe(0);
  });

  it('closes every session on shutdown', async () => {
    const { ctx, connect } = setup();
    const a = connect();
    const b = connect();

    ctx.net.closeAll('server shutting down');

    expect(a.closed?.code).toBe(CloseCode.goingAway);
    expect(b.closed?.reason).toBe('server shutting down');
  });
});
