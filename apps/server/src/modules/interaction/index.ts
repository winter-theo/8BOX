import {
  type ActionCheck,
  type ActionDef,
  type ActionReason,
  type ActionSubject,
  type ActionTarget,
  type Actor,
  actionApplies,
  type LayerId,
  subjectInReach,
  type TileSlot,
  tileSlotSchema,
  tileThing,
} from '@8box/shared';
import type { EntityId, Position } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import { safeZoneOf } from '../../core/safeZone';
import type { Session } from '../../net/session';

/** An action that takes time, waiting for its end. */
interface Pending {
  action: ActionDef;
  target: ActionTarget;
  session: Session;
  /** Where the player stood when it started: moving cancels it. */
  start: Position;
  endsAtTick: number;
}

/** What a player aims an action at, from the world as the server has it; undefined when gone. */
function subjectOf(
  ctx: ServerContext,
  entity: EntityId,
  layer: number,
  target: ActionTarget,
): ActionSubject | undefined {
  switch (target.kind) {
    case 'self':
      return { kind: 'self' };
    case 'tile': {
      const { x, y } = target;
      if (!ctx.world.isInside(x, y)) {
        return undefined;
      }
      const tiles: Partial<Record<TileSlot, string>> = {};
      for (const slot of tileSlotSchema.options) {
        const tile = ctx.world.getTile(layer as LayerId, x, y, slot);
        if (tile) {
          tiles[slot] = tile.id;
        }
      }
      const meta = ctx.world.getMeta(layer as LayerId, x, y);
      return { kind: 'tile', x, y, tiles, ...(meta && { meta }) };
    }
    case 'entity': {
      const kind = ctx.entities.typeOf(target.id);
      const position = ctx.entities.get(target.id, 'position');
      // One's own character is the 'self' target.
      if (target.id === entity || !kind || !position || position.layer !== layer) {
        return undefined;
      }
      const item = ctx.entities.get(target.id, 'groundItem')?.item;
      const name = ctx.entities.get(target.id, 'player')?.name;
      return {
        kind: 'entity',
        id: target.id,
        entity: kind,
        x: position.x,
        y: position.y,
        ...(item !== undefined && { item }),
        ...(name !== undefined && { name }),
      };
    }
  }
}

/**
 * Checks an action like the client does, but with the world as the server has it: the target is
 * still there, the action applies to it, it is in reach, and `canPerform` says yes.
 */
function check(
  ctx: ServerContext,
  session: Session,
  entity: EntityId,
  action: ActionDef,
  target: ActionTarget,
): { ok: true; subject: ActionSubject } | { ok: false; reason: ActionReason } {
  const position = ctx.entities.get(entity, 'position');
  const inventory = ctx.entities.get(entity, 'inventory');
  const hunger = ctx.entities.get(entity, 'hunger');
  if (!position || !inventory || ctx.entities.has(entity, 'dead')) {
    return { ok: false, reason: 'unavailable' };
  }
  const actor: Actor = {
    layer: position.layer,
    x: position.x,
    y: position.y,
    inventory,
    admin: session.account?.role === 'admin',
    ...(hunger !== undefined && { hunger }),
  };
  const subject = subjectOf(ctx, entity, position.layer, target);
  if (!subject) {
    return { ok: false, reason: 'gone' };
  }
  if (!actionApplies(action, subject, ctx.content, actor)) {
    return { ok: false, reason: 'unavailable' };
  }
  if (!subjectInReach(actor, subject, ctx.config.interaction.reachTiles)) {
    return { ok: false, reason: 'outOfReach' };
  }
  const result: ActionCheck = action.canPerform({
    actor,
    subject,
    content: ctx.content,
    safeZone: safeZoneOf(ctx),
  });
  return result.ok ? { ok: true, subject } : result;
}

/** What "examine" tells: the name of a tile or of the items of a pile (and how many), or a player. */
function examine(ctx: ServerContext, session: Session, subject: ActionSubject): void {
  if (subject.kind === 'tile') {
    const thing = tileThing(subject.tiles);
    ctx.net.send(session, { t: 'examined', ...(thing !== undefined && { thing }) });
  } else if (subject.kind === 'entity' && subject.name !== undefined) {
    ctx.net.send(session, { t: 'examined', player: subject.name });
  } else if (subject.kind === 'entity' && subject.item !== undefined) {
    const count = ctx.entities.get(subject.id, 'groundItem')?.count;
    ctx.net.send(session, {
      t: 'examined',
      thing: subject.item,
      ...(count !== undefined && { count }),
    });
  }
}

/**
 * Actions on the world, the Project Zomboid way. Clients send `action { id, target }`; the server checks
 * the reach (`interaction.reachTiles`), `canPerform` (with the safe zone, and whether the player is an
 * admin) and the delays again (one action at a time, and `actionCooldownMs` between two), then calls
 * the `perform` the owning module registered (`ctx.actions`). An action that takes time ends `durationMs` later, checked again, unless the player
 * moves first (cancelled). Every request is answered with `action` (started, done, cancelled or
 * refused); each action done emits `action.performed`. A dead player cannot act. Also performs "examine".
 */
export const interactionModule: GameModule = {
  id: 'interaction',
  dependsOn: ['players'],
  init(ctx) {
    const pending = new Map<EntityId, Pending>();
    /** Tick when each player last started an action. */
    const lastStart = new Map<EntityId, number>();
    const cooldownTicks = ctx.scheduler.ticksFor(ctx.config.interaction.actionCooldownMs);

    const refuse = (session: Session, id: string, reason: ActionReason) => {
      ctx.log.debug({ session: session.id, action: id, reason }, 'action refused');
      ctx.net.send(session, { t: 'action', id, outcome: 'refused', reason });
    };

    const perform = (
      session: Session,
      entity: EntityId,
      action: ActionDef,
      target: ActionTarget,
    ) => {
      const checked = check(ctx, session, entity, action, target);
      const reason = checked.ok
        ? ctx.actions.performer(action.id)?.({ session, entity, subject: checked.subject })
        : checked.reason;
      if (reason) {
        refuse(session, action.id, reason);
      } else {
        ctx.net.send(session, { t: 'action', id: action.id, outcome: 'done' });
        ctx.events.emit('action.performed', { entity, action: action.id });
      }
    };

    ctx.actions.register('examine', ({ session, subject }) => {
      examine(ctx, session, subject);
      return undefined;
    });

    ctx.net.onMessage('action', (session, { id, target }) => {
      const entity = session.player?.entity;
      if (entity === undefined || !ctx.entities.exists(entity)) {
        return;
      }
      const action = ctx.actions.registry.get(id);
      if (!action || !ctx.actions.performer(id)) {
        refuse(session, id, 'unavailable');
        return;
      }
      if (pending.has(entity)) {
        refuse(session, id, 'busy');
        return;
      }
      const tick = ctx.scheduler.currentTick;
      const last = lastStart.get(entity);
      if (last !== undefined && tick - last < cooldownTicks) {
        refuse(session, id, 'tooSoon');
        return;
      }
      const checked = check(ctx, session, entity, action, target);
      if (!checked.ok) {
        refuse(session, id, checked.reason);
        return;
      }
      lastStart.set(entity, tick);
      const position = ctx.entities.get(entity, 'position');
      if (action.durationMs && position) {
        pending.set(entity, {
          action,
          target,
          session,
          start: position,
          endsAtTick: tick + ctx.scheduler.ticksFor(action.durationMs),
        });
        ctx.net.send(session, {
          t: 'action',
          id,
          outcome: 'started',
          durationMs: action.durationMs,
        });
        return;
      }
      perform(session, entity, action, target);
    });

    ctx.events.on('entity.removed', ({ entity }) => {
      pending.delete(entity);
      lastStart.delete(entity);
    });

    // After the movement inputs: an action in progress ends when the player has moved.
    ctx.systems.add({
      name: 'interaction: actions in progress',
      phase: 'simulate',
      run: () => {
        const tick = ctx.scheduler.currentTick;
        for (const [entity, action] of pending) {
          const position = ctx.entities.get(entity, 'position');
          const { start, session } = action;
          if (
            !position ||
            position.layer !== start.layer ||
            position.x !== start.x ||
            position.y !== start.y
          ) {
            pending.delete(entity);
            ctx.net.send(session, { t: 'action', id: action.action.id, outcome: 'cancelled' });
          } else if (tick >= action.endsAtTick) {
            pending.delete(entity);
            perform(session, entity, action.action, action.target);
          }
        }
      },
    });
  },
};
