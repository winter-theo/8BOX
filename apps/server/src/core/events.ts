import {
  type Inventory,
  type ItemStack,
  type LayerId,
  type TileSlot,
  TypedEmitter,
} from '@8box/shared';
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
  /** A player broke a tile (its slot is already empty): cut, uprooted or broken. */
  'tile.broken': {
    layer: LayerId;
    x: number;
    y: number;
    slot: TileSlot;
    /** The tile id that was there. */
    tile: string;
    /** The player who broke it. */
    by: EntityId;
  };
  /**
   * Request: give items to a player (loot), in their inventory, and on the ground at their feet what
   * does not fit. Handled by the inventory module.
   */
  'items.give': { entity: EntityId; items: readonly ItemStack[] };
  /**
   * Request: replace the inventory of a player by this one, computed with the shared operations from the
   * current one (crafting, placing). Handled by the inventory module, which sends it to the client.
   */
  'inventory.set': { entity: EntityId; inventory: Inventory };
  /**
   * A player hit something with the tool in hand (hotbar slot `slot`): the inventory module wears it
   * by one use, and it breaks at 0.
   */
  'tool.used': { entity: EntityId; item: string; slot: number };
  /** A player crafted a recipe once (its ingredients are taken, what it gives is in the inventory). */
  'item.crafted': { entity: EntityId; recipe: string };
  /** A player placed the item in hand: tile `tile` is now in slot `slot` of (x, y). */
  'tile.placed': {
    layer: LayerId;
    x: number;
    y: number;
    slot: TileSlot;
    tile: string;
    /** The player who placed it. */
    by: EntityId;
  };
};

/** Synchronous typed bus: `emit` returns once every listener has run. */
export type EventBus = TypedEmitter<ServerEvents>;

export function createEventBus(): EventBus {
  return new TypedEmitter<ServerEvents>();
}
