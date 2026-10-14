import {
  type DamageCause,
  type Inventory,
  type ItemStack,
  type LayerId,
  type TileSlot,
  TypedEmitter,
} from '@8box/shared';
import type { Session } from '../net/session';
import type { TileChange, TileMetaChange } from '../world/World';
import type { EntityId, EntityType, Position } from './entities';

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
  /** The state of a tile changed (`World.setMeta`): a door opened or closed. */
  'tile.meta': TileMetaChange;
  /** A player broke a tile (its slot is already empty): cut, uprooted or broken; or a monster did. */
  'tile.broken': {
    layer: LayerId;
    x: number;
    y: number;
    slot: TileSlot;
    /** The tile id that was there. */
    tile: string;
    /** The player who broke it, or the monster (`tile.hit`). */
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
  /**
   * Request: put items on the ground at `position` (the loot of a monster). Handled by the inventory
   * module.
   */
  'items.drop': { position: Position; items: readonly ItemStack[] };
  /**
   * Request: a monster hits the tile in slot `slot` of (x, y) (a wall or a door in its way) and takes
   * `amount` of its HP, like the hits of the players. Handled by the harvest module: at 0 the tile is
   * broken (`tile.broken`), without loot.
   */
  'tile.hit': {
    layer: LayerId;
    x: number;
    y: number;
    slot: TileSlot;
    amount: number;
    by: EntityId;
  };
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
  /** A player's action was done (after its `perform`), e.g. to tire them (`ActionDef.effort`). */
  'action.performed': { entity: EntityId; action: string };
  /**
   * An entity's health reached 0 (`damage`): it is now `dead`, where it stood. The inventory module
   * drops a share of a player's gold there.
   */
  'entity.died': {
    entity: EntityId;
    type: EntityType;
    position: Position;
    source: DamageSource;
  };
  /**
   * An entity lost health (`damage`): `amount` HP, where it stood. Emitted before `entity.died` when
   * the blow kills it. The combat module shows it to the players nearby.
   */
  'entity.damaged': {
    entity: EntityId;
    type: EntityType;
    amount: number;
    position: Position;
    source: DamageSource;
  };
  /**
   * A player killed another player (combat module): `firstHit` is the one of the two who hit the
   * other first in their fight (the reputation will blame them, P7).
   */
  'player.killed': { killer: EntityId; victim: EntityId; firstHit: EntityId };
  /** A dead player came back to life, at their bed or at the spawn. */
  'player.respawned': { entity: EntityId; position: Position };
};

/** What hurts an entity (`damage`). */
export interface DamageSource {
  cause: DamageCause;
  /** The entity that dealt it, if any (a hit). */
  by?: EntityId;
}

/** Synchronous typed bus: `emit` returns once every listener has run. */
export type EventBus = TypedEmitter<ServerEvents>;

export function createEventBus(): EventBus {
  return new TypedEmitter<ServerEvents>();
}
