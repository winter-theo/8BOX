import { LAYER, PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { playersModule, spawnPosition } from './index';

function setup() {
  const test = createTestContext({ devAuth: true, modules: [playersModule] });
  const log: string[] = [];
  test.ctx.events.on('player.joined', ({ name }) => log.push(`joined ${name}`));
  test.ctx.events.on('player.left', ({ name, reason }) => log.push(`left ${name} (${reason})`));
  const join = async (name: string) => {
    const client = connectFakeClient(test.ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: name });
    await settle();
    return client;
  };
  return { ...test, log, join };
}

describe('players module', () => {
  it('spawns a player entity at the spawn point and welcomes the client', async () => {
    const { ctx, log, join } = setup();

    const client = await join('Ana');

    const entity = client.session.player?.entity ?? -1;
    expect(client.last()).toEqual({
      t: 'welcome',
      you: { entity, name: 'Ana', position: spawnPosition(ctx.world) },
      tick: 0,
    });
    expect(ctx.entities.typeOf(entity)).toBe('player');
    expect(ctx.entities.get(entity, 'position')).toEqual(spawnPosition(ctx.world));
    expect(ctx.entities.get(entity, 'player')).toEqual({
      name: 'Ana',
      playerId: client.session.account?.playerId,
    });
    expect(log).toEqual(['joined Ana']);
  });

  it('removes the entity and emits player.left when the client leaves', async () => {
    const { ctx, log, join } = setup();
    const client = await join('Ana');
    const entity = client.session.player?.entity ?? -1;

    ctx.net.handleClose(client.session);

    expect(ctx.entities.exists(entity)).toBe(false);
    expect(log).toEqual(['joined Ana', 'left Ana (connection closed)']);
  });

  it('follows two players at once', async () => {
    const { ctx, join } = setup();

    await join('Ana');
    await join('Bob');

    expect(ctx.entities.ofType('player')).toHaveLength(2);
  });

  it('replaces the entity of a player who joins again with the same name', async () => {
    const { ctx, log, join } = setup();
    const first = await join('Ana');
    const second = await join('Ana');

    expect(ctx.entities.exists(first.session.player?.entity ?? -1)).toBe(false);
    expect(ctx.entities.ofType('player')).toEqual([second.session.player?.entity]);
    expect(log).toEqual(['joined Ana', 'left Ana (rejected: replaced)', 'joined Ana']);
  });

  it('brings a player back where they left, whatever the case of their name', async () => {
    const { ctx, join } = setup();
    const first = await join('Ana');
    const entity = first.session.player?.entity ?? -1;
    ctx.entities.set(entity, 'position', { layer: LAYER.surface, x: 20.5, y: 30.25 });

    ctx.net.handleClose(first.session);
    const playerId = first.session.account?.playerId ?? -1;
    expect(ctx.persistence.character(playerId)).toEqual({ playerId, layer: 0, x: 20.5, y: 30.25 });

    const again = await join('ANA');
    expect(again.last()).toMatchObject({ t: 'welcome', you: { position: { x: 20.5, y: 30.25 } } });
    expect(ctx.entities.get(again.session.player?.entity ?? -1, 'position')).toEqual({
      layer: 0,
      x: 20.5,
      y: 30.25,
    });
  });

  it('starts at the spawn when the saved place is outside the world', async () => {
    const { ctx, join } = setup();
    const first = await join('Bob');
    const playerId = first.session.account?.playerId ?? -1;
    ctx.net.handleClose(first.session);
    ctx.persistence.saveCharacter({ playerId, layer: 0, x: 99_999, y: 5 });

    const bob = await join('Bob');

    expect(ctx.entities.get(bob.session.player?.entity ?? -1, 'position')).toEqual(
      spawnPosition(ctx.world),
    );
  });

  it('does not spawn anything for a rejected client', async () => {
    const { ctx, log } = setup();
    const client = connectFakeClient(ctx);

    client.send({ t: 'hello', version: PROTOCOL_VERSION + 1, devName: 'Ana' });

    expect(ctx.entities.size).toBe(0);
    expect(log).toEqual([]);
  });
});
