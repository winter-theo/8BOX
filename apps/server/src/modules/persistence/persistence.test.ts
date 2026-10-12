import { baseContent, LAYER, loadContent, PROTOCOL_VERSION } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { connectFakeClient, createTestContext, settle } from '../../core/testing';
import { Persistence } from '../../persistence/Persistence';
import { MemoryStore } from '../../persistence/store';
import { WriteQueue } from '../../persistence/writeQueue';
import { playersModule } from '../players';
import { persistenceModule, saveEverything } from './index';

const content = loadContent(baseContent);

function setup() {
  const store = new MemoryStore();
  const writes = new WriteQueue({ store, onError: () => {} });
  const persistence = new Persistence(content, writes);
  const test = createTestContext({
    content,
    devAuth: true,
    persistence,
    modules: [playersModule, persistenceModule],
  });
  const ticksFor = (ms: number) => test.ctx.scheduler.ticksFor(ms);
  return { ...test, store, persistence, ticksFor };
}

describe('persistence module', () => {
  it('saves the modified chunks every 30 s, outside the tick', async () => {
    const { ctx, tick, store, persistence, ticksFor } = setup();
    ctx.world.setTile(LAYER.surface, 3, 4, 'object', 'base:oak_tree');

    tick(ticksFor(ctx.config.persistence.chunkSaveIntervalMs) - 1);
    await persistence.flush();
    expect(store.chunks.size).toBe(0);

    tick();
    expect(store.chunks.size).toBe(0); // Queued, written after the tick.
    await persistence.flush();
    expect([...store.chunks.keys()]).toEqual(['0:0:0']);
    expect(store.chunks.get('0:0:0')?.palette).toContain('base:oak_tree');
  });

  it('saves the connected characters every 60 s', async () => {
    const { ctx, tick, store, persistence, ticksFor } = setup();
    const client = connectFakeClient(ctx);
    client.send({ t: 'hello', version: PROTOCOL_VERSION, devName: 'Ana' });
    await settle();
    const entity = client.session.player?.entity ?? -1;
    ctx.entities.set(entity, 'position', { layer: LAYER.surface, x: 10.5, y: 20.25 });

    // A live client answers the heartbeat, or the server would drop it before the save.
    const ticks = ticksFor(ctx.config.persistence.characterSaveIntervalMs);
    for (let done = 0; done < ticks; done += 20) {
      tick(Math.min(20, ticks - done));
      ctx.net.handlePong(client.session);
    }
    await persistence.flush();

    const playerId = client.session.account?.playerId ?? -1;
    expect(store.characters.get(playerId)).toEqual({ playerId, layer: 0, x: 10.5, y: 20.25 });
  });

  it('saves everything left on shutdown', async () => {
    const { ctx, store, persistence } = setup();
    ctx.world.setTile(LAYER.surface, 40, 40, 'object', null);

    saveEverything(ctx);
    await persistence.flush();

    expect([...store.chunks.keys()]).toEqual(['0:1:1']);
  });
});
