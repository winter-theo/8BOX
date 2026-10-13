import type { EntityId } from './entities';
import type { DamageSource } from './events';
import type { ServerContext } from './module';

/**
 * Takes `amount` HP from an entity that has health: nothing while it is dead or invulnerable
 * (`invulnerableUntilTick`). At 0 HP it dies: it becomes `dead` (with the cause) and `entity.died` is
 * emitted, where it stood. Used by starvation (survival module) and by combat (step 22). Returns the HP
 * taken.
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
  if (health - taken === 0) {
    ctx.entities.set(entity, 'dead', source.cause);
    if (position) {
      ctx.events.emit('entity.died', { entity, type, position, source });
    }
  }
  return taken;
}
