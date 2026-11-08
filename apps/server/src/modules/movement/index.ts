import {
  boxIsFree,
  chunkCoord,
  createMovementWorld,
  ghostMovementWorld,
  LAYER,
  type LayerId,
  type MovementInput,
  type MovementWorld,
  stepMovement,
} from '@8box/shared';
import type { Components, EntityId, Position } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';

/** Half a tile: `/tp x y` puts the player at the center of tile (x, y). */
const TILE_CENTER = 0.5;

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
    (x, y) => ctx.world.getMeta(layer, x, y),
  );
}

/**
 * Authoritative movement. Clients send what they hold (`input { seq, dir }`, 20 per second); the
 * server applies at most one input per tick and per player, each worth one tick of walking, so
 * sending faster never moves faster: extra inputs wait, and beyond `maxQueuedInputs` the oldest are
 * dropped. Moving the position also moves the entity in the spatial index, and the chunks module
 * streams around it. Sets the `facing`, `anim` and `inputAck` components that snapshots carry. The
 * admin commands `/tp` and `/tphere` teleport players.
 */
export const movementModule: GameModule = {
  id: 'movement',
  dependsOn: ['players'],
  init(ctx) {
    const queues = new Map<EntityId, InputQueue>();
    const worlds = new Map<LayerId, MovementWorld>();
    /** Admin mode: only the edges of the world stop the player. */
    const ghostWorld = ghostMovementWorld((x, y) => ctx.world.isInside(x, y));
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

    /**
     * Puts a player at `to`, if the point is in the world and their box fits there (anywhere in admin
     * mode). Their client replays its pending inputs from there.
     */
    const teleport = (entity: EntityId, to: Position): 'outside' | 'blocked' | undefined => {
      const inWorld =
        ctx.world.isInside(Math.floor(to.x), Math.floor(to.y)) &&
        ctx.world.getChunk(to.layer as LayerId, chunkCoord(to.x), chunkCoord(to.y)) !== undefined;
      if (!inWorld) {
        return 'outside';
      }
      const world = worldOf(to.layer as LayerId);
      if (
        !ctx.entities.has(entity, 'adminMode') &&
        !boxIsFree(world, to.x, to.y, ctx.config.player.hitboxSizeTiles)
      ) {
        return 'blocked';
      }
      ctx.entities.set(entity, 'position', { ...to });
      return undefined;
    };

    ctx.commands.add({
      id: 'tp',
      names: ['tp'],
      permission: 'admin',
      forms: [
        [
          { kind: 'int', min: 0 },
          { kind: 'int', min: 0 },
          { kind: 'int', min: LAYER.mine, max: LAYER.upper, optional: true },
        ],
        [{ kind: 'player' }],
      ],
      run: ({ entity, form, args, session, reply }) => {
        let to: Position | undefined;
        if (form === 0) {
          to = {
            layer: args.optionalInt(2) ?? LAYER.surface,
            x: args.int(0) + TILE_CENTER,
            y: args.int(1) + TILE_CENTER,
          };
        } else {
          const target = args.player(0);
          if (target === session) {
            reply({ notice: 'self' });
            return;
          }
          to = target.player && ctx.entities.get(target.player.entity, 'position');
        }
        if (!to) {
          return;
        }
        const refusal = teleport(entity, to);
        reply(
          refusal
            ? { notice: 'refused', command: 'tp', reason: refusal }
            : {
                notice: 'done',
                command: 'tp',
                values: { x: Math.floor(to.x), y: Math.floor(to.y) },
              },
        );
      },
    });
    ctx.commands.add({
      id: 'tphere',
      names: ['tphere'],
      permission: 'admin',
      forms: [[{ kind: 'player' }]],
      run: ({ entity, args, session, reply }) => {
        const target = args.player(0);
        const name = target.name ?? '';
        const moved = target.player?.entity;
        const to = ctx.entities.get(entity, 'position');
        if (target === session) {
          reply({ notice: 'self' });
        } else if (moved === undefined || !to) {
          return;
        } else if (ctx.entities.has(moved, 'dead')) {
          reply({ notice: 'refused', command: 'tphere', reason: 'dead', name });
        } else {
          const refusal = teleport(moved, to);
          reply(
            refusal
              ? { notice: 'refused', command: 'tphere', reason: refusal, name }
              : { notice: 'done', command: 'tphere', name },
          );
        }
      },
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
          // A dead player does not move until they respawn (their inputs are dropped).
          if (!input || ctx.entities.has(entity, 'dead')) {
            setIfChanged(ctx, entity, 'anim', 'idle');
            continue;
          }
          const facing = ctx.entities.get(entity, 'facing') ?? 'down';
          const next = stepMovement(
            { x: position.x, y: position.y, facing },
            input,
            dt,
            ctx.entities.has(entity, 'adminMode') ? ghostWorld : worldOf(position.layer as LayerId),
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
