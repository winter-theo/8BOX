import {
  createMovementWorld,
  type LayerId,
  type MovementInput,
  type MovementWorld,
  stepMovement,
} from '@8box/shared';
import type { Components, EntityId } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';

interface QueuedInput extends MovementInput {
  seq: number;
}

/** Inputs of one player, waiting for their tick. */
interface InputQueue {
  inputs: QueuedInput[];
  /** Highest `seq` received: older or repeated inputs are ignored. */
  lastSeq: number;
}

function setIfChanged<K extends 'facing' | 'anim'>(
  ctx: ServerContext,
  entity: EntityId,
  name: K,
  value: Components[K],
): void {
  if (ctx.entities.get(entity, name) !== value) {
    ctx.entities.set(entity, name, value);
  }
}

/** Movement view of a layer of the server world (outside the map is solid). */
function movementWorld(ctx: ServerContext, layer: LayerId): MovementWorld {
  return createMovementWorld(
    (x, y, slot) => ctx.world.getTile(layer, x, y, slot),
    (x, y) => ctx.world.isInside(x, y),
  );
}

/**
 * Authoritative movement. Clients send what they hold (`input { seq, dir }`, 20 per second); the
 * server applies at most one input per tick and per player, each worth one tick of walking, so
 * sending faster never moves faster: extra inputs wait, and beyond `maxQueuedInputs` the oldest are
 * dropped. Moving the position also moves the entity in the spatial index, and the chunks module
 * streams around it. Sets the `facing`, `anim` and `inputAck` components that snapshots carry.
 */
export const movementModule: GameModule = {
  id: 'movement',
  dependsOn: ['players'],
  init(ctx) {
    const queues = new Map<EntityId, InputQueue>();
    const worlds = new Map<LayerId, MovementWorld>();
    const worldOf = (layer: LayerId) => {
      let world = worlds.get(layer);
      if (!world) {
        world = movementWorld(ctx, layer);
        worlds.set(layer, world);
      }
      return world;
    };

    ctx.net.onMessage('input', (session, { seq, dir }) => {
      const entity = session.player?.entity;
      if (entity === undefined || !ctx.entities.exists(entity)) {
        return;
      }
      let queue = queues.get(entity);
      if (!queue) {
        queue = { inputs: [], lastSeq: -1 };
        queues.set(entity, queue);
      }
      if (seq <= queue.lastSeq) {
        return; // Repeated or late.
      }
      queue.lastSeq = seq;
      queue.inputs.push({ seq, dir });
      const excess = queue.inputs.length - ctx.config.net.maxQueuedInputs;
      if (excess > 0) {
        queue.inputs.splice(0, excess);
      }
    });
    ctx.events.on('entity.removed', ({ entity }) => {
      queues.delete(entity);
    });

    ctx.systems.add({
      name: 'movement: apply inputs',
      phase: 'input',
      run: (_ctx, dt) => {
        for (const [entity, queue] of queues) {
          const input = queue.inputs.shift();
          const position = ctx.entities.get(entity, 'position');
          if (!position) {
            continue;
          }
          if (!input) {
            setIfChanged(ctx, entity, 'anim', 'idle');
            continue;
          }
          const facing = ctx.entities.get(entity, 'facing') ?? 'down';
          const next = stepMovement(
            { x: position.x, y: position.y, facing },
            input,
            dt,
            worldOf(position.layer as LayerId),
            ctx.config.player,
          );
          const moved = next.x !== position.x || next.y !== position.y;
          if (moved) {
            ctx.entities.set(entity, 'position', { layer: position.layer, x: next.x, y: next.y });
          }
          setIfChanged(ctx, entity, 'facing', next.facing);
          setIfChanged(ctx, entity, 'anim', moved ? 'walk' : 'idle');
          ctx.entities.set(entity, 'inputAck', input.seq);
        }
      },
    });
  },
};
