import {
  type ActionOption,
  ActionRegistry,
  type ActionSubject,
  type Actor,
  aimedTile,
  baseActions,
  type Content,
  type Facing,
  INTERACTION,
  type Inventory,
  listActions,
  spawnSafeZone,
  type TileDef,
  type TilePoint,
  type TileSlot,
  tileInReach,
  tileSlotSchema,
  WORLD,
} from '@8box/shared';
import type { RemoteView } from './world/RemoteEntities';

/** Where nothing is broken: around the spawn, in the middle of the surface. */
const SAFE_ZONE = spawnSafeZone(WORLD.layerSizeTiles, WORLD.safeZoneRadiusTiles);

/** What the client knows that actions depend on. */
export interface InteractionSources {
  /** The player of this client now (feet in tiles), or undefined when not in the world. */
  player(): { layer: number; x: number; y: number; facing: Facing } | undefined;
  /** As the server last sent it. */
  inventory(): Inventory | null;
  /** A tile of the chunks received (undefined when empty or not loaded). */
  tile(layer: number, x: number, y: number, slot: TileSlot): TileDef | undefined;
  /** The other entities, where they are drawn. */
  remotes(): readonly RemoteView[];
  /** Whether the player is an admin (may break things in the safe zone), as `welcome` said. */
  admin(): boolean;
}

/**
 * The actions the player can do, as the client sees the world: the aimed tile (in front of the
 * player, or under the mouse when in reach), and the actions on a tile with `canPerform` (and the safe
 * zone). The server checks every action again.
 */
export class Interaction {
  /** Tile under the mouse (computer); undefined off the world or on a touch screen. */
  private pointer: TilePoint | undefined;

  constructor(
    private readonly sources: InteractionSources,
    private readonly content: Content,
    readonly registry = new ActionRegistry(baseActions),
  ) {}

  setPointerTile(tile: TilePoint | undefined): void {
    this.pointer = tile;
  }

  /** The tile the player aims at; undefined when not in the world. */
  aimedTile(): TilePoint | undefined {
    const player = this.sources.player();
    return player && aimedTile(player, player.facing, this.pointer, INTERACTION.reachTiles);
  }

  /** Whether the player reaches tile (x, y). */
  inReach(x: number, y: number): boolean {
    const player = this.sources.player();
    return player !== undefined && tileInReach(player, x, y, INTERACTION.reachTiles);
  }

  /** What actions can target on tile (x, y): the tile itself, then the entities standing on it. */
  subjectsAt(x: number, y: number): ActionSubject[] {
    const player = this.sources.player();
    if (!player) {
      return [];
    }
    const tiles: Partial<Record<TileSlot, string>> = {};
    for (const slot of tileSlotSchema.options) {
      const tile = this.sources.tile(player.layer, x, y, slot);
      if (tile) {
        tiles[slot] = tile.id;
      }
    }
    const subjects: ActionSubject[] = [{ kind: 'tile', x, y, tiles }];
    if (Math.floor(player.x) === x && Math.floor(player.y) === y) {
      subjects.push({ kind: 'self' });
    }
    for (const remote of this.sources.remotes()) {
      if (Math.floor(remote.x) === x && Math.floor(remote.y) === y) {
        subjects.push({
          kind: 'entity',
          id: remote.id,
          entity: remote.kind,
          x: remote.x,
          y: remote.y,
          ...(remote.item !== undefined && { item: remote.item }),
          ...(remote.kind === 'player' && remote.name !== undefined && { name: remote.name }),
        });
      }
    }
    return subjects;
  }

  /** Every action on tile (x, y), possible or not, highest priority first. */
  optionsAt(x: number, y: number): ActionOption[] {
    const player = this.sources.player();
    const inventory = this.sources.inventory();
    if (!player || !inventory) {
      return [];
    }
    const actor: Actor = {
      layer: player.layer,
      x: player.x,
      y: player.y,
      inventory,
      admin: this.sources.admin(),
    };
    return listActions(this.registry, actor, this.subjectsAt(x, y), this.content, SAFE_ZONE);
  }
}
