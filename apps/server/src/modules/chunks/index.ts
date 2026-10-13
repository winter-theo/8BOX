import { chunkCoord, encodeChunk, type LayerId } from '@8box/shared';
import type { GameModule, ServerContext } from '../../core/module';
import { ChunkSubscriptions, type InterestOptions, type ViewSize } from '../../net/interest';
import type { Session } from '../../net/session';

interface StreamState {
  subscriptions: ChunkSubscriptions;
  view: ViewSize | undefined;
  /** Dev mode: free camera position, used instead of the player position. */
  debugCamera: { x: number; y: number } | undefined;
}

function interestOptions(ctx: ServerContext): InterestOptions {
  const { net, world } = ctx.config;
  return {
    tileSizePx: world.tileSizePx,
    chunksPerSide: ctx.world.chunksPerSide,
    maxRadiusChunks: net.maxSubscriptionRadiusChunks,
    prefetchMarginChunks: net.chunkPrefetchMarginChunks,
    unloadMarginChunks: net.chunkUnloadMarginChunks,
  };
}

/**
 * Streams the world to each client: the chunks around its player (or its debug camera) as they come
 * into view, `chunkUnload` for the ones left behind, and `tileUpdate` (`tileMeta` for a state, such as
 * a door) for every change in a subscribed chunk.
 */
export const chunksModule: GameModule = {
  id: 'chunks',
  dependsOn: ['players'],
  init(ctx) {
    const states = new Map<Session, StreamState>();
    const options = interestOptions(ctx);
    const stateOf = (session: Session): StreamState => {
      let state = states.get(session);
      if (!state) {
        state = {
          subscriptions: new ChunkSubscriptions(options),
          view: undefined,
          debugCamera: undefined,
        };
        states.set(session, state);
        session.chunks = state.subscriptions;
      }
      return state;
    };

    ctx.net.onMessage('viewport', (session, { w, h, zoom }) => {
      stateOf(session).view = { w, h, zoom };
    });
    ctx.net.onMessage('debugCamera', (session, { at }) => {
      if (!ctx.net.devAuth) {
        ctx.log.debug({ session: session.id }, 'debug camera ignored outside dev mode');
        return;
      }
      stateOf(session).debugCamera = at ?? undefined;
    });
    ctx.events.on('session.closed', ({ session }) => {
      states.delete(session);
    });

    ctx.systems.add({
      name: 'chunks: stream',
      phase: 'net',
      run: () => {
        for (const session of ctx.net.allSessions()) {
          const player = session.state === 'playing' ? session.player : undefined;
          const position = player && ctx.entities.get(player.entity, 'position');
          if (!position) {
            continue;
          }
          const state = stateOf(session);
          const center = state.debugCamera
            ? { ...state.debugCamera, layer: position.layer }
            : position;
          const { add, remove } = state.subscriptions.update(
            center,
            state.view,
            ctx.config.net.maxChunksPerTick,
          );
          for (const ref of remove) {
            ctx.net.send(session, { t: 'chunkUnload', ...ref });
          }
          for (const ref of add) {
            const chunk = ctx.world.getChunk(ref.layer as LayerId, ref.cx, ref.cy);
            if (chunk) {
              ctx.net.send(session, encodeChunk(chunk, ctx.content));
            }
          }
        }
      },
    });

    ctx.events.on('tile.changed', ({ layer, x, y, slot, tile }) => {
      const ref = { layer, cx: chunkCoord(x), cy: chunkCoord(y) };
      for (const [session, state] of states) {
        if (state.subscriptions.has(ref)) {
          ctx.net.send(session, { t: 'tileUpdate', layer, x, y, slot, tile });
        }
      }
    });

    ctx.events.on('tile.meta', ({ layer, x, y, meta }) => {
      const ref = { layer, cx: chunkCoord(x), cy: chunkCoord(y) };
      for (const [session, state] of states) {
        if (state.subscriptions.has(ref)) {
          ctx.net.send(session, { t: 'tileMeta', layer, x, y, meta });
        }
      }
    });
  },
};
