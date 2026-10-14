import { createMovementWorld, type Facing, knockback, type LayerId, pushMover } from '@8box/shared';
import type { EntityId } from './entities';
import type { DamageSource } from './events';
import type { ServerContext } from './module';

/**
 * Takes `amount` HP from an entity that has health: nothing while it is dead or invulnerable
 * (`invulnerableUntilTick`), and emits `entity.damaged`. At 0 HP it dies: it becomes `dead` (with the
 * cause) and `entity.died` is emitted, where it stood. Used by starvation (survival module) and by hits
 * (combat module). Returns the HP taken.
 */
export function damage(
  ctx: ServerContext,
  entity: EntityId,
  amount: number,
  source: DamageSource,
): number {
  const health = ctx.entities.get(entity, 'health');
  const type = ctx.entities.typeOf(entity);
  if (
    health === undefined ||
    type === undefined ||
    health <= 0 ||
    amount <= 0 ||
    ctx.entities.has(entity, 'dead')
  ) {
    return 0;
  }
  const invulnerableUntil = ctx.entities.get(entity, 'invulnerableUntilTick');
  if (invulnerableUntil !== undefined && ctx.scheduler.currentTick < invulnerableUntil) {
    return 0;
  }
  const taken = Math.min(health, amount);
  ctx.entities.set(entity, 'health', health - taken);
  const position = ctx.entities.get(entity, 'position');
  if (position) {
    ctx.events.emit('entity.damaged', { entity, type, amount: taken, position, source });
  }
  if (health - taken === 0) {
    ctx.entities.set(entity, 'dead', source.cause);
    if (position) {
      ctx.events.emit('entity.died', { entity, type, position, source });
    }
  }
  return taken;
}

/**
 * A hit: `damage`, then, when the target took some and lives, `hitInvulnerabilityMs` without damage and
 * a push of `knockbackTiles` toward `facing` (the facing of the attacker), stopped by the solid tiles.
 * Used by the hits of the players (combat module) and of the monsters (ai module). Returns the HP taken.
 */
export function hitEntity(
  ctx: ServerContext,
  target: EntityId,
  amount: number,
  source: DamageSource,
  facing: Facing,
): number {
  const taken = damage(ctx, target, amount, source);
  const position = ctx.entities.get(target, 'position');
  if (taken === 0 || !position || ctx.entities.has(target, 'dead')) {
    return taken;
  }
  const { combat } = ctx.config;
  const tick = ctx.scheduler.currentTick;
  ctx.entities.set(
    target,
    'invulnerableUntilTick',
    tick + ctx.scheduler.ticksFor(combat.hitInvulnerabilityMs),
  );
  const layer = position.layer as LayerId;
  const world = createMovementWorld(
    (x, y, slot) => ctx.world.getTile(layer, x, y, slot),
    (x, y) => ctx.world.isInside(x, y),
    (x, y) => ctx.world.getMeta(layer, x, y),
  );
  const push = knockback(facing, combat);
  const moved = pushMover({ ...position, facing }, push.dx, push.dy, world);
  ctx.entities.set(target, 'position', { layer: position.layer, x: moved.x, y: moved.y });
  return taken;
}
