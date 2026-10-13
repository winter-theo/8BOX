import {
  addItems,
  createMovementWorld,
  FACING_STEP,
  type Facing,
  type Inventory,
  type ItemStack,
  type LayerId,
  stackLimit,
} from '@8box/shared';
import type { EntityId, Position } from '../../core/entities';
import type { ServerContext } from '../../core/module';

/** Where the items a player drops land: in front of them, or at their feet when that tile is solid. */
export function dropPosition(ctx: ServerContext, feet: Position, facing: Facing): Position {
  const [dx, dy] = FACING_STEP[facing];
  const distance = ctx.config.inventory.dropDistanceTiles;
  const x = feet.x + dx * distance;
  const y = feet.y + dy * distance;
  const world = createMovementWorld(
    (tx, ty, slot) => ctx.world.getTile(feet.layer as LayerId, tx, ty, slot),
    (tx, ty) => ctx.world.isInside(tx, ty),
  );
  return world.isSolid(Math.floor(x), Math.floor(y)) ? feet : { layer: feet.layer, x, y };
}

/**
 * Puts items on the ground. They join a pile of the same item lying close by when it has room (the
 * pile then waits as long as a new one), otherwise they make a new pile. `droppedBy` (`players.id`)
 * waits before picking them up again.
 */
export function spawnGroundItem(
  ctx: ServerContext,
  position: Position,
  stack: ItemStack,
  droppedBy?: number,
): EntityId {
  const { groundMergeRadiusTiles, dropPickupDelayMs, groundItemLifetimeMs } = ctx.config.inventory;
  const tick = ctx.scheduler.currentTick;
  const timing = {
    dropperWaitUntilTick: tick + ctx.scheduler.ticksFor(dropPickupDelayMs),
    expiresAtTick: tick + ctx.scheduler.ticksFor(groundItemLifetimeMs),
    ...(droppedBy !== undefined && { droppedBy }),
  };
  const limit = stackLimit(ctx.content.items, stack.item);
  const { layer, x, y } = position;
  for (const id of ctx.entities.near(layer, x, y, groundMergeRadiusTiles)) {
    const pile = ctx.entities.get(id, 'groundItem');
    if (pile?.item === stack.item && pile.count + stack.count <= limit) {
      ctx.entities.set(id, 'groundItem', {
        item: pile.item,
        count: pile.count + stack.count,
        ...timing,
      });
      return id;
    }
  }
  return ctx.entities.create('groundItem', {
    position,
    groundItem: { item: stack.item, count: stack.count, ...timing },
  });
}

/**
 * Players pick up the piles at their feet, as much as fits (the rest stays on the ground). Players are
 * handled one after the other, so a pile two players reach in the same tick goes to one of them.
 * Calls `picked` for each player whose inventory changed.
 */
export function pickUpGroundItems(ctx: ServerContext, picked: (entity: EntityId) => void): void {
  const radius = ctx.config.inventory.pickupRadiusTiles;
  const tick = ctx.scheduler.currentTick;
  for (const entity of ctx.entities.query('player', 'inventory', 'position')) {
    const position = ctx.entities.get(entity, 'position');
    const playerId = ctx.entities.get(entity, 'player')?.playerId;
    let inventory = ctx.entities.get(entity, 'inventory');
    if (!position || !inventory) {
      continue;
    }
    let changed = false;
    for (const id of ctx.entities.near(position.layer, position.x, position.y, radius)) {
      const pile = ctx.entities.get(id, 'groundItem');
      if (!pile || (pile.droppedBy === playerId && tick < pile.dropperWaitUntilTick)) {
        continue;
      }
      const next = takePile(ctx, inventory, id);
      if (next) {
        inventory = next;
        changed = true;
      }
    }
    if (changed) {
      ctx.entities.set(entity, 'inventory', inventory);
      picked(entity);
    }
  }
}

/**
 * Puts as much of a pile on the ground as fits into an inventory; the rest stays on the ground. Returns
 * the new inventory, or undefined when nothing was taken (no room, or no such pile).
 */
export function takePile(
  ctx: ServerContext,
  inventory: Inventory,
  pileId: EntityId,
): Inventory | undefined {
  const pile = ctx.entities.get(pileId, 'groundItem');
  if (!pile) {
    return undefined;
  }
  const added = addItems(inventory, ctx.content.items, pile);
  if (added.left === pile.count) {
    return undefined;
  }
  if (added.left === 0) {
    ctx.entities.remove(pileId);
  } else {
    ctx.entities.set(pileId, 'groundItem', { ...pile, count: added.left });
  }
  return added.inventory;
}

/** Removes the piles that lay on the ground for too long. */
export function expireGroundItems(ctx: ServerContext): void {
  const tick = ctx.scheduler.currentTick;
  for (const id of ctx.entities.query('groundItem')) {
    const pile = ctx.entities.get(id, 'groundItem');
    if (pile && pile.expiresAtTick <= tick) {
      ctx.entities.remove(id);
    }
  }
}
