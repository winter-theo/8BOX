import { type ClientMessage, encodeMessage, PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { playersModule } from '../players';
import { skinsModule } from './index';

async function setup() {
  const { ctx } = createTestContext({ devAuth: true, modules: [playersModule, skinsModule] });
  const client = connectFakeClient(ctx);
  client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
  await settle();
  const skin = () => ctx.entities.get(client.session.player?.entity ?? -1, 'skin');
  return { ctx, client, skin };
}

describe('skins module', () => {
  it('gives the skin a player picks to their character', async () => {
    const { client, skin } = await setup();
    expect(skin()).toBe('theo');

    client.send({ t: 'setSkin', skin: 'cat' });

    expect(skin()).toBe('cat');
  });

  it('ignores a skin the game does not have', async () => {
    const { client, skin } = await setup();

    client.sendRaw(encodeMessage({ t: 'setSkin', skin: 'dragon' } as unknown as ClientMessage));

    expect(skin()).toBe('theo');
  });

  it('saves the skin with the character when the player leaves', async () => {
    const { ctx, client } = await setup();
    client.send({ t: 'setSkin', skin: 'freddy' });

    ctx.net.handleClose(client.session);

    const playerId = client.session.account?.playerId ?? -1;
    expect(ctx.persistence.character(playerId)?.skin).toBe('freddy');
  });
});
