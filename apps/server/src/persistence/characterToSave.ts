import { DEFAULT_SKIN, emptyInventory } from '@8box/shared';
import type { EntityId } from '../core/entities';
import type { ServerContext } from '../core/module';
import type { SavedCharacter } from './store';

/**
 * What to save of a player character, from its components: where it stands, how it looks, what it
 * carries, where it comes back (its bed), its health and hunger. Without an inventory component (a test without the inventory
 * module), the saved one stays.
 */
export function characterToSave(ctx: ServerContext, entity: EntityId): SavedCharacter | undefined {
  const player = ctx.entities.get(entity, 'player');
  const position = ctx.entities.get(entity, 'position');
  if (!player || !position) {
    return undefined;
  }
  const inventory =
    ctx.entities.get(entity, 'inventory') ??
    ctx.persistence.character(player.playerId)?.inventory ??
    emptyInventory();
  const spawnPoint = ctx.entities.get(entity, 'spawnPoint');
  const health = ctx.entities.get(entity, 'health');
  const hunger = ctx.entities.get(entity, 'hunger');
  return {
    playerId: player.playerId,
    layer: position.layer,
    x: position.x,
    y: position.y,
    skin: ctx.entities.get(entity, 'skin') ?? DEFAULT_SKIN,
    inventory: { slots: inventory.slots, equipment: inventory.equipment, purse: inventory.purse },
    ...(spawnPoint && { spawnPoint }),
    ...(health !== undefined && { health }),
    ...(hunger !== undefined && { hunger }),
  };
}
