import {
  chunkCoord,
  type DamageCause,
  type EntityAnim,
  type EntityKind,
  type Facing,
  type Inventory,
  type ItemStack,
  type Skin,
} from '@8box/shared';
import type { EventBus } from './events';
import { type ChunkRef, type Position, SpatialIndex } from './spatial';

export type { Position } from './spatial';

export type EntityId = number;

/** Kinds of entities (shared with the clients). Later steps add `animal`, `npc`… */
export type EntityType = EntityKind;

/**
 * Catalogue of the entity components (name → data). Each step adds the components of its systems here
 * (motion, health, hunger, inventory, ai, groundItem…).
 */
export interface Components {
  /** Never mutate it in place: `set` it again so the spatial index follows. */
  position: Position;
  /** Entities controlled by a connected player (`playerId`: their account). */
  player: { name: string; playerId: number };
  /** Last direction moved in (aim and hits). */
  facing: Facing;
  /** How clients draw it: walking while it moves. */
  anim: EntityAnim;
  /** Look of a player character, picked by its player. */
  skin: Skin;
  /** `seq` of the last movement input applied (player entities). */
  inputAck: number;
  /** What a player character carries. Never mutate it in place: `set` a new one (shared operations). */
  inventory: Inventory;
  /** Where a player character comes back after death (step 20): the bed it last slept in. */
  spawnPoint: SpawnPoint;
  /** Items lying on the ground. */
  groundItem: GroundItem;
  /** Hit points (step 20), from 0 to `SURVIVAL.maxHealth`. Never set it to 0 directly: see `damage`. */
  health: number;
  /** Hunger points of a player character (step 20), from 0 (starving) to `SURVIVAL.maxHunger`. */
  hunger: number;
  /** Dead (0 HP), with what killed it: a player cannot move nor act until they respawn. */
  dead: DamageCause;
  /** Tick until which damage is ignored (after respawning). */
  invulnerableUntilTick: number;
  /** A monster (step 23): which creature it is (`content.creatures`). Monsters are never saved. */
  monster: { creature: string };
}

/** A tile of the world: the bed where a player character comes back (`spawnPoint`). */
export interface SpawnPoint {
  layer: number;
  /** Tile coordinates. */
  x: number;
  y: number;
}

/** A pile of items on the ground (`groundItem` entities). */
export interface GroundItem extends ItemStack {
  /** Player (`players.id`) who dropped it, who cannot pick it up before `dropperWaitUntilTick`. */
  droppedBy?: number;
  dropperWaitUntilTick: number;
  /** Tick when it disappears. */
  expiresAtTick: number;
}

/**
 * Entities with typed components stored in one `Map` per component, and a spatial index by layer and
 * chunk kept up to date whenever a position is set.
 */
export class EntityStore<C extends { position: Position } = Components> {
  private nextId: EntityId = 1;
  private readonly types = new Map<EntityId, EntityType>();
  private readonly stores = new Map<keyof C, Map<EntityId, unknown>>();
  private readonly spatial = new SpatialIndex();

  constructor(private readonly events?: EventBus) {}

  get size(): number {
    return this.types.size;
  }

  /** Creates an entity with its initial components, then emits `entity.created`. */
  create(type: EntityType, components: Partial<C> = {}): EntityId {
    const entity = this.nextId++;
    this.types.set(entity, type);
    for (const name of Object.keys(components) as (keyof C)[]) {
      const value = components[name];
      if (value !== undefined) {
        this.set(entity, name, value as C[keyof C]);
      }
    }
    this.events?.emit('entity.created', { entity, type });
    return entity;
  }

  /** Removes an entity and all its components, then emits `entity.removed`. */
  remove(entity: EntityId): boolean {
    const type = this.types.get(entity);
    if (type === undefined) {
      return false;
    }
    for (const store of this.stores.values()) {
      store.delete(entity);
    }
    this.spatial.remove(entity);
    this.types.delete(entity);
    this.events?.emit('entity.removed', { entity, type });
    return true;
  }

  exists(entity: EntityId): boolean {
    return this.types.has(entity);
  }

  typeOf(entity: EntityId): EntityType | undefined {
    return this.types.get(entity);
  }

  ids(): IterableIterator<EntityId> {
    return this.types.keys();
  }

  ofType(type: EntityType): EntityId[] {
    return [...this.types].filter(([, entityType]) => entityType === type).map(([id]) => id);
  }

  countByType(): Partial<Record<EntityType, number>> {
    const counts: Partial<Record<EntityType, number>> = {};
    for (const type of this.types.values()) {
      counts[type] = (counts[type] ?? 0) + 1;
    }
    return counts;
  }

  get<K extends keyof C>(entity: EntityId, name: K): C[K] | undefined {
    return this.storeOf(name).get(entity);
  }

  has(entity: EntityId, name: keyof C): boolean {
    return this.stores.get(name)?.has(entity) ?? false;
  }

  set<K extends keyof C>(entity: EntityId, name: K, value: C[K]): void {
    if (!this.types.has(entity)) {
      throw new Error(`Cannot set "${String(name)}" on unknown entity ${entity}`);
    }
    this.storeOf(name).set(entity, value);
    if (name === 'position') {
      this.spatial.update(entity, value as Position);
    }
  }

  delete(entity: EntityId, name: keyof C): void {
    this.stores.get(name)?.delete(entity);
    if (name === 'position') {
      this.spatial.remove(entity);
    }
  }

  /** Entities that have every listed component (snapshot: safe to modify the store while iterating). */
  query(...names: (keyof C)[]): EntityId[] {
    if (names.length === 0) {
      return [...this.types.keys()];
    }
    const stores = names.map((name) => this.stores.get(name));
    if (stores.some((store) => store === undefined || store.size === 0)) {
      return [];
    }
    const present = stores as Map<EntityId, unknown>[];
    const [smallest, ...others] = present.sort((a, b) => a.size - b.size);
    return [...(smallest?.keys() ?? [])].filter((id) => others.every((store) => store.has(id)));
  }

  /** Entities with a position in the given chunk. */
  inChunk(chunk: ChunkRef): ReadonlySet<EntityId> {
    return this.spatial.inChunk(chunk);
  }

  /** Entities of a layer within `radius` tiles of (x, y). */
  near(layer: number, x: number, y: number, radius: number): EntityId[] {
    const result: EntityId[] = [];
    for (let cy = chunkCoord(y - radius); cy <= chunkCoord(y + radius); cy++) {
      for (let cx = chunkCoord(x - radius); cx <= chunkCoord(x + radius); cx++) {
        for (const entity of this.spatial.inChunk({ layer, cx, cy })) {
          const position = this.get(entity, 'position');
          if (position && (position.x - x) ** 2 + (position.y - y) ** 2 <= radius ** 2) {
            result.push(entity);
          }
        }
      }
    }
    return result;
  }

  private storeOf<K extends keyof C>(name: K): Map<EntityId, C[K]> {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    return store as Map<EntityId, C[K]>;
  }
}
