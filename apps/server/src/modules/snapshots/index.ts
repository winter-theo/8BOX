import type { EntityState } from '@8box/shared';
import type { EntityId } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import { entitiesInChunks } from '../../net/interest';
import type { Session } from '../../net/session';

/** After the chunk streaming in the `net` phase: a chunk received this tick comes with its entities. */
const AFTER_STREAMING = 1;

function entityState(ctx: ServerContext, id: EntityId, known: boolean): EntityState | undefined {
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
  if (!known && name !== undefined) {
    state.name = name;
  }
  return state;
}

/**
 * Every tick, each client gets a `snapshot`: its own player (position, facing, last input applied) and
 * the entities in the chunks it receives, never the others. An entity's name comes the first time the
 * client sees it, and `gone` lists the entities that left its view.
 */
export const snapshotsModule: GameModule = {
  id: 'snapshots',
  dependsOn: ['players', 'movement', 'chunks'],
  init(ctx) {
    /** Entities each client saw in its last snapshot. */
    const known = new Map<Session, Set<EntityId>>();
    ctx.events.on('session.closed', ({ session }) => {
      known.delete(session);
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
          const previous = known.get(session) ?? new Set<EntityId>();
          const visible = new Set<EntityId>();
          const entities: EntityState[] = [];
          const ids = entitiesInChunks(
            session.chunks?.chunks() ?? [],
            (ref) => ctx.entities.inChunk(ref),
            self,
          );
          for (const id of ids) {
            const state = entityState(ctx, id, previous.has(id));
            if (state) {
              entities.push(state);
              visible.add(id);
            }
          }
          const gone = [...previous].filter((id) => !visible.has(id));
          known.set(session, visible);
          ctx.net.send(session, {
            t: 'snapshot',
            tick,
            ackSeq: ctx.entities.get(self, 'inputAck') ?? -1,
            you: {
              x: position.x,
              y: position.y,
              facing: ctx.entities.get(self, 'facing') ?? 'down',
            },
            entities,
            ...(gone.length > 0 && { gone }),
          });
        }
      },
    });
  },
};
