import type { EntityState, Skin } from '@8box/shared';
import type { EntityId } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import { entitiesInChunks } from '../../net/interest';
import type { Session } from '../../net/session';

/** After the chunk streaming in the `net` phase: a chunk received this tick comes with its entities. */
const AFTER_STREAMING = 1;

/** Entities a client saw in its last snapshot, with the skin it was sent for each (players). */
type Known = Map<EntityId, Skin | undefined>;

function entityState(ctx: ServerContext, id: EntityId, known: Known): EntityState | undefined {
  const kind = ctx.entities.typeOf(id);
  const position = ctx.entities.get(id, 'position');
  if (kind === undefined || !position) {
    return undefined;
  }
  const state: EntityState = {
    id,
    kind,
    x: position.x,
    y: position.y,
    facing: ctx.entities.get(id, 'facing') ?? 'down',
    anim: ctx.entities.get(id, 'anim') ?? 'idle',
  };
  const name = ctx.entities.get(id, 'player')?.name;
  if (!known.has(id) && name !== undefined) {
    state.name = name;
  }
  const skin = ctx.entities.get(id, 'skin');
  if (skin !== undefined && (!known.has(id) || known.get(id) !== skin)) {
    state.skin = skin;
  }
  return state;
}

/**
 * Every tick, each client gets a `snapshot`: its own player (position, facing, last input applied) and
 * the entities in the chunks it receives, never the others. An entity's name comes the first time the
 * client sees it, its skin then and whenever it changes (its own skin too), and `gone` lists the
 * entities that left its view.
 */
export const snapshotsModule: GameModule = {
  id: 'snapshots',
  dependsOn: ['players', 'movement', 'chunks'],
  init(ctx) {
    const known = new Map<Session, Known>();
    /** The skin of its own player each client was sent last. */
    const ownSkins = new Map<Session, Skin>();
    ctx.events.on('session.closed', ({ session }) => {
      known.delete(session);
      ownSkins.delete(session);
    });

    ctx.systems.add({
      name: 'snapshots: send',
      phase: 'net',
      order: AFTER_STREAMING,
      run: () => {
        const tick = ctx.scheduler.currentTick;
        for (const session of ctx.net.allSessions()) {
          const self = session.state === 'playing' ? session.player?.entity : undefined;
          const position = self === undefined ? undefined : ctx.entities.get(self, 'position');
          if (self === undefined || !position) {
            continue;
          }
          const previous: Known = known.get(session) ?? new Map();
          const visible: Known = new Map();
          const entities: EntityState[] = [];
          const ids = entitiesInChunks(
            session.chunks?.chunks() ?? [],
            (ref) => ctx.entities.inChunk(ref),
            self,
          );
          for (const id of ids) {
            const state = entityState(ctx, id, previous);
            if (state) {
              entities.push(state);
              visible.set(id, ctx.entities.get(id, 'skin'));
            }
          }
          const gone = [...previous.keys()].filter((id) => !visible.has(id));
          known.set(session, visible);
          const skin = ctx.entities.get(self, 'skin');
          const newSkin = skin !== undefined && ownSkins.get(session) !== skin;
          if (newSkin) {
            ownSkins.set(session, skin);
          }
          ctx.net.send(session, {
            t: 'snapshot',
            tick,
            ackSeq: ctx.entities.get(self, 'inputAck') ?? -1,
            you: {
              x: position.x,
              y: position.y,
              facing: ctx.entities.get(self, 'facing') ?? 'down',
              ...(newSkin && { skin }),
            },
            entities,
            ...(gone.length > 0 && { gone }),
          });
        }
      },
    });
  },
};
