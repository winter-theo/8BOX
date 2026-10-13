import {
  CHAT,
  type ChatLineMessage,
  type ChatNoticeMessage,
  LAYER,
  PROTOCOL_VERSION,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, type FakeClient, settle } from '../../core/testing';
import { playersModule } from '../players';
import { chatModule } from './index';

function setup() {
  let now = 0;
  const { ctx } = createTestContext({
    devAuth: true,
    now: () => now,
    modules: [playersModule, chatModule],
  });
  /** A player in the game, standing at (x, y) of a layer. */
  const join = async (name: string, x: number, y: number, layer: number = LAYER.surface) => {
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    const entity = client.session.player?.entity;
    if (entity === undefined) {
      throw new Error(`${name} did not join`);
    }
    ctx.entities.set(entity, 'position', { layer, x, y });
    client.received.length = 0;
    return client;
  };
  const say = (client: FakeClient, text: string, to?: string) =>
    client.send({ t: 'chat', text, ...(to !== undefined && { to }) });
  const advance = (ms: number) => {
    now += ms;
  };
  return { ctx, join, say, advance };
}

function lines(client: FakeClient): ChatLineMessage[] {
  return client.received.filter((message): message is ChatLineMessage => message.t === 'chat');
}

function notices(client: FakeClient): ChatNoticeMessage[] {
  return client.received.filter(
    (message): message is ChatNoticeMessage => message.t === 'chatNotice',
  );
}

describe('chat module', () => {
  it('reaches the players of the same layer within 16 tiles, the speaker included', async () => {
    const { join, say } = setup();
    const ana = await join('Ana', 10, 10);
    const near = await join('Near', 10 + CHAT.proximityRadiusTiles, 10);
    const far = await join('Far', 10 + CHAT.proximityRadiusTiles + 0.5, 10);
    const below = await join('Below', 10, 10, LAYER.surface + 1);

    say(ana, 'Salut !');

    const expected = {
      t: 'chat',
      channel: 'proximity',
      from: 'Ana',
      entity: ana.session.player?.entity,
      text: 'Salut !',
    };
    expect(lines(ana)).toEqual([expect.objectContaining(expected)]);
    expect(lines(near)).toEqual([expect.objectContaining(expected)]);
    expect(lines(far)).toEqual([]);
    expect(lines(below)).toEqual([]);
  });

  it('sends private lines at any distance, with /msg, /r and `to`', async () => {
    const { join, say } = setup();
    const ana = await join('Ana', 10, 10);
    const bob = await join('Bob', 60, 60);
    const near = await join('Near', 11, 10);

    say(ana, '/msg bob on se voit au lac ?');
    const toBob = { channel: 'private', from: 'Ana', to: 'Bob', text: 'on se voit au lac ?' };
    expect(lines(bob)).toEqual([expect.objectContaining(toBob)]);
    expect(lines(ana)).toEqual([expect.objectContaining(toBob)]);
    expect(lines(near)).toEqual([]);

    say(bob, '/r oui');
    expect(lines(ana).at(-1)).toEqual(
      expect.objectContaining({ channel: 'private', from: 'Bob', to: 'Ana', text: 'oui' }),
    );

    say(ana, '/msg ne sera pas lu', 'Bob');
    expect(lines(bob).at(-1)).toEqual(
      expect.objectContaining({ from: 'Ana', to: 'Bob', text: '/msg ne sera pas lu' }),
    );
  });

  it('tells the sender when a private line has nobody to reach', async () => {
    const { join, say } = setup();
    const ana = await join('Ana', 10, 10);

    say(ana, '/r anyone?');
    say(ana, '/msg Ghost hello');
    say(ana, 'hello', 'ana');
    say(ana, '/dance');
    say(ana, '/msg Ghost');

    expect(notices(ana)).toEqual([
      { t: 'chatNotice', notice: 'noReplyTarget' },
      { t: 'chatNotice', notice: 'unknownPlayer', name: 'Ghost' },
      { t: 'chatNotice', notice: 'self' },
      { t: 'chatNotice', notice: 'unknownCommand' },
      { t: 'chatNotice', notice: 'msgUsage' },
    ]);
    expect(lines(ana)).toEqual([]);
  });

  it('filters words and refuses messages that are too long', async () => {
    const { join, say, advance } = setup();
    const ana = await join('Ana', 10, 10);
    const bob = await join('Bob', 12, 10);

    say(ana, 'espèce de connard');
    expect(lines(bob)).toEqual([expect.objectContaining({ text: 'espèce de ***' })]);

    say(ana, 'a'.repeat(CHAT.maxMessageLength + 1));
    expect(notices(ana)).toEqual([{ t: 'chatNotice', notice: 'tooLong' }]);
    advance(CHAT.rateLimitWindowMs);
    say(ana, `/msg Bob ${'a'.repeat(CHAT.maxMessageLength + 1)}`);
    expect(notices(ana).at(-1)?.notice).toBe('tooLong');
    expect(lines(bob)).toHaveLength(1);
  });

  it('limits the rate of lines, then lets the player talk again', async () => {
    const { join, say, advance } = setup();
    const ana = await join('Ana', 10, 10);

    for (let i = 0; i < CHAT.rateLimitMessages + 1; i++) {
      say(ana, `line ${i}`);
    }
    expect(lines(ana)).toHaveLength(CHAT.rateLimitMessages);
    expect(notices(ana)).toEqual([{ t: 'chatNotice', notice: 'tooFast' }]);

    advance(CHAT.rateLimitWindowMs);
    say(ana, 'calm now');
    expect(lines(ana).at(-1)?.text).toBe('calm now');
  });

  it('blocks muted players until the end of their mute, with a notice', async () => {
    const { ctx, join, say } = setup();
    const ana = await join('Ana', 10, 10);
    const bob = await join('Bob', 12, 10);
    const account = ana.session.account;
    if (!account) {
      throw new Error('no account');
    }
    const until = new Date(Date.now() + 60_000);

    ctx.net.applyAccount({ ...account, mutedUntil: until }); // What the admin's mute does.
    say(ana, 'hello?');
    say(ana, '/msg Bob hello?');

    expect(lines(bob)).toEqual([]);
    expect(notices(ana)).toEqual([
      { t: 'chatNotice', notice: 'muted', until: until.getTime() },
      { t: 'chatNotice', notice: 'muted', until: until.getTime() },
    ]);

    ctx.net.applyAccount({ ...account, mutedUntil: new Date(Date.now() - 1) });
    say(ana, 'back');
    expect(lines(bob)).toEqual([expect.objectContaining({ text: 'back' })]);
  });
});

describe('reports', () => {
  it('records a report with the last lines the reporter saw, and tells them', async () => {
    const { ctx, join, say, advance } = setup();
    const ana = await join('Ana', 10, 10);
    const bob = await join('Bob', 12, 10);
    const lineCount = CHAT.reportContextMessages + 5;
    for (let i = 0; i < lineCount; i++) {
      say(bob, `line ${i}`);
      advance(CHAT.rateLimitWindowMs);
    }
    say(bob, 'espèce de connard');

    say(ana, '/signaler bob insultes répétées');
    await settle();

    expect(notices(ana)).toEqual([{ t: 'chatNotice', notice: 'reported', name: 'Bob' }]);
    const [report] = await ctx.reports.list(10);
    expect(report).toMatchObject({
      reporterName: 'Ana',
      targetName: 'Bob',
      reason: 'insultes répétées',
      status: 'open',
    });
    expect(report?.context).toHaveLength(CHAT.reportContextMessages);
    expect(report?.context.at(-1)).toEqual({
      ts: expect.any(Number),
      channel: 'proximity',
      from: 'Bob',
      text: 'espèce de ***',
    });
    expect(report?.context[0]?.text).toBe(`line ${lineCount - CHAT.reportContextMessages + 1}`);
  });

  it('keeps private lines in the context, and lets muted players report', async () => {
    const { ctx, join, say } = setup();
    const ana = await join('Ana', 10, 10);
    await join('Bob', 60, 60);
    const account = ana.session.account;
    if (!account) {
      throw new Error('no account');
    }
    say(ana, '/msg Bob arrête');
    ctx.net.applyAccount({ ...account, mutedUntil: new Date(Date.now() + 60_000) });

    say(ana, '/report Bob spam');
    await settle();

    expect(notices(ana).at(-1)).toEqual({ t: 'chatNotice', notice: 'reported', name: 'Bob' });
    const [report] = await ctx.reports.list(10);
    expect(report?.context).toEqual([
      { ts: expect.any(Number), channel: 'private', from: 'Ana', to: 'Bob', text: 'arrête' },
    ]);
  });

  it('refuses reports against nobody or oneself', async () => {
    const { ctx, join, say } = setup();
    const ana = await join('Ana', 10, 10);

    say(ana, '/signaler Ghost triche');
    say(ana, '/signaler ana test');
    say(ana, '/signaler Ghost');
    await settle();

    expect(notices(ana)).toEqual([
      { t: 'chatNotice', notice: 'self' },
      { t: 'chatNotice', notice: 'reportUsage' },
      { t: 'chatNotice', notice: 'unknownPlayer', name: 'Ghost' },
    ]);
    expect(await ctx.reports.list(10)).toEqual([]);
  });
});
