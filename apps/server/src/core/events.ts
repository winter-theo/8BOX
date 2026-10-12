import { TypedEmitter } from '@8box/shared';
import type { EntityId, EntityType } from './entities';

/**
 * Catalogue of the server events (name → payload). Modules react to events instead of calling each
 * other. Each step adds the events of its systems here (player.joined, tile.broken, item.crafted…).
 */
export type ServerEvents = {
  /** An entity was created, with its initial components. */
  'entity.created': { entity: EntityId; type: EntityType };
  /** An entity was removed, with all its components. */
  'entity.removed': { entity: EntityId; type: EntityType };
};

/** Synchronous typed bus: `emit` returns once every listener has run. */
export type EventBus = TypedEmitter<ServerEvents>;

export function createEventBus(): EventBus {
  return new TypedEmitter<ServerEvents>();
}
