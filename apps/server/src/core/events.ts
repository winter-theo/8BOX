import { TypedEmitter } from '@8box/shared';
import type { Session } from '../net/session';
import type { TileChange } from '../world/World';
import type { EntityId, EntityType } from './entities';

/**
 * Catalogue of the server events (name → payload). Modules react to events instead of calling each
 * other. Each step adds the events of its systems here (tile.broken, item.crafted…).
 */
export type ServerEvents = {
  /** An entity was created, with its initial components. */
  'entity.created': { entity: EntityId; type: EntityType };
  /** An entity was removed, with all its components. */
  'entity.removed': { entity: EntityId; type: EntityType };
  /**
   * A client passed the handshake (`session.name` is set). A listener must set `session.player`,
   * otherwise the session is rejected (`unavailable`).
   */
  'session.authenticated': { session: Session };
  /** A session ended, whatever the cause (left, rejected, kicked, dead connection). */
  'session.closed': { session: Session; reason: string };
  /** A player entered the world. */
  'player.joined': { entity: EntityId; name: string };
  /** A player left the world; their entity is already removed. */
  'player.left': { entity: EntityId; name: string; reason: string };
  /** A tile slot of the world changed (`World.setTile`). */
  'tile.changed': TileChange;
};

/** Synchronous typed bus: `emit` returns once every listener has run. */
export type EventBus = TypedEmitter<ServerEvents>;

export function createEventBus(): EventBus {
  return new TypedEmitter<ServerEvents>();
}
