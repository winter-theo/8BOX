import {
  type CraftReason,
  type CraftStateMessage,
  craftOnce,
  type Inventory,
  type LayerId,
  type RecipeDef,
  stationInReach,
} from '@8box/shared';
import type { EntityId, Position } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import type { Session } from '../../net/session';

/** A craft in progress: one of the `left` crafts asked, which ends at `endsAtTick`. */
interface PendingCraft {
  session: Session;
  recipe: RecipeDef;
  /** Crafts left, the one in progress included. */
  left: number;
  /** Where the player stood when it started: moving cancels it. */
  start: Position;
  endsAtTick: number;
}

/**
 * Crafts a recipe once for a player, from the world and the inventory as the server has them: the
 * station in reach (when the recipe needs one), then the ingredients and the room (`craftOnce`).
 */
function attempt(
  ctx: ServerContext,
  entity: EntityId,
  recipe: RecipeDef,
): { ok: true; inventory: Inventory } | { ok: false; reason: CraftReason } {
  const position = ctx.entities.get(entity, 'position');
  const inventory = ctx.entities.get(entity, 'inventory');
  if (!position || !inventory) {
    return { ok: false, reason: 'missingItems' };
  }
  const { station } = recipe;
  const layer = position.layer as LayerId;
  if (
    station !== undefined &&
    !stationInReach(position, station, ctx.config.crafting.stationReachTiles, (x, y, slot) =>
      ctx.world.getTile(layer, x, y, slot),
    )
  ) {
    return { ok: false, reason: 'noStation' };
  }
  return craftOnce(inventory, ctx.content.items, recipe);
}

/**
 * Crafting from a list of recipes. Clients send `craft { recipe, count }`; the server checks the
 * station (within `crafting.stationReachTiles`), the ingredients and the room, then crafts the recipe
 * `count` times, one after the other: each craft takes the `timeMs` of the recipe (a progress bar on
 * the client), is checked again at its end, then takes the ingredients and gives what it makes (to the
 * inventory module, `inventory.set`). Moving cancels the craft in progress (the crafts already done
 * stay). Every request is answered with `craft` (started, done, cancelled or refused).
 */
export const craftingModule: GameModule = {
  id: 'crafting',
  dependsOn: ['players'],
  init(ctx) {
    const pending = new Map<EntityId, PendingCraft>();

    const send = (
      session: Session,
      recipe: string,
      outcome: CraftStateMessage['outcome'],
      extra: Partial<CraftStateMessage> = {},
    ) => ctx.net.send(session, { t: 'craft', recipe, outcome, ...extra });

    const refuse = (session: Session, recipe: string, reason: CraftReason) => {
      ctx.log.debug({ session: session.id, recipe, reason }, 'craft refused');
      send(session, recipe, 'refused', { reason });
    };

    /** Starts the next craft of a recipe: `left` crafts to go, this one included. */
    const start = (session: Session, entity: EntityId, recipe: RecipeDef, left: number) => {
      const position = ctx.entities.get(entity, 'position');
      if (!position) {
        return;
      }
      pending.set(entity, {
        session,
        recipe,
        left,
        start: position,
        endsAtTick: ctx.scheduler.currentTick + ctx.scheduler.ticksFor(recipe.timeMs),
      });
      send(session, recipe.id, 'started', { durationMs: recipe.timeMs, left });
    };

    ctx.net.onMessage('craft', (session, { recipe: id, count }) => {
      const entity = session.player?.entity;
      if (
        entity === undefined ||
        !ctx.entities.exists(entity) ||
        ctx.entities.has(entity, 'dead')
      ) {
        return;
      }
      const recipe = ctx.content.recipes.get(id);
      if (!recipe) {
        refuse(session, id, 'unknownRecipe');
        return;
      }
      if (pending.has(entity)) {
        refuse(session, id, 'busy');
        return;
      }
      const checked = attempt(ctx, entity, recipe);
      if (!checked.ok) {
        refuse(session, id, checked.reason);
        return;
      }
      start(session, entity, recipe, count);
    });

    ctx.events.on('entity.removed', ({ entity }) => {
      pending.delete(entity);
    });

    // After the movement inputs: a craft in progress ends when the player has moved.
    ctx.systems.add({
      name: 'crafting: crafts in progress',
      phase: 'simulate',
      run: () => {
        const tick = ctx.scheduler.currentTick;
        for (const [entity, craft] of pending) {
          const { session, recipe, start: from } = craft;
          const position = ctx.entities.get(entity, 'position');
          if (
            !position ||
            position.layer !== from.layer ||
            position.x !== from.x ||
            position.y !== from.y
          ) {
            pending.delete(entity);
            send(session, recipe.id, 'cancelled');
            continue;
          }
          if (tick < craft.endsAtTick) {
            continue;
          }
          const result = attempt(ctx, entity, recipe);
          if (!result.ok) {
            pending.delete(entity);
            refuse(session, recipe.id, result.reason);
            continue;
          }
          ctx.events.emit('inventory.set', { entity, inventory: result.inventory });
          ctx.events.emit('item.crafted', { entity, recipe: recipe.id });
          if (craft.left > 1) {
            start(session, entity, recipe, craft.left - 1);
          } else {
            pending.delete(entity);
            send(session, recipe.id, 'done');
          }
        }
      },
    });
  },
};
