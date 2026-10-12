import { PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext } from '../../core/testing';
import { playersModule, spawnPosition } from './index';

function setup() {
  const test = createTestContext({ devAuth: true, modules: [playersModule] });
  const log: string[] = [];
  test.ctx.events.on('player.joined', ({ name }) => log.push(`joined ${name}`));
  test.ctx.events.on('player.left', ({ name, reason }) => log.push(`left ${name} (${reason})`));
  const join = (name: string) => {
    const client = connectFakeClient(test.ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    return client;
  };
  return { ...test, log, join };
}

describe('players module', () => {
  it('spawns a player entity at the spawn point and welcomes the client', () => {
    const { ctx, log, join } = setup();

    const client = join('Ana');

    const entity = client.session.player?.entity ?? -1;
    expect(client.last()).toEqual({
      t: 'welcome',
      you: { entity, name: 'Ana' },
      tick: 0,
    });
    expect(ctx.entities.typeOf(entity)).toBe('player');
    expect(ctx.entities.get(entity, 'position')).toEqual(spawnPosition(ctx.world));
    expect(ctx.entities.get(entity, 'player')).toEqual({ name: 'Ana' });
    expect(log).toEqual(['joined Ana']);
  });

  it('removes the entity and emits player.left when the client leaves', () => {
    const { ctx, log, join } = setup();
    const client = join('Ana');
    const entity = client.session.player?.entity ?? -1;

    ctx.net.handleClose(client.session);

    expect(ctx.entities.exists(entity)).toBe(false);
    expect(log).toEqual(['joined Ana', 'left Ana (connection closed)']);
  });

  it('follows two players at once', () => {
    const { ctx, join } = setup();

    join('Ana');
    join('Bob');

    expect(ctx.entities.ofType('player')).toHaveLength(2);
  });

  it('replaces the entity of a player who joins again with the same name', () => {
    const { ctx, log, join } = setup();
    const first = join('Ana');
    const second = join('Ana');

    expect(ctx.entities.exists(first.session.player?.entity ?? -1)).toBe(false);
    expect(ctx.entities.ofType('player')).toEqual([second.session.player?.entity]);
    expect(log).toEqual(['joined Ana', 'left Ana (rejected: replaced)', 'joined Ana']);
  });

  it('does not spawn anything for a rejected client', () => {
    const { ctx, log } = setup();
    const client = connectFakeClient(ctx);

    client.send({ t: 'hello', version: PROTOCOL_VERSION + 1, devName: 'Ana' });

    expect(ctx.entities.size).toBe(0);
    expect(log).toEqual([]);
  });
});
