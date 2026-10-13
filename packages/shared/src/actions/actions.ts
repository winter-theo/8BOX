import type { Content } from '../content/load';
import type { TileSlot } from '../content/schemas';
import type { Inventory } from '../inventory/inventory';
import type { EntityKind } from '../protocol/messages';
import type { SafeZone } from '../world/safeZone';

/** What an action can be aimed at: a tile, an entity standing there, or the player themselves. */
export type ActionTargetKind = 'tile' | 'entity' | 'self';

/** What an action is aimed at, as the client sends it (`action { id, target }`). */
export type ActionTarget =
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'entity'; id: number }
  | { kind: 'self' };

/**
 * What the target is, as both sides see it: the server builds it from the world, the client from the
 * chunks and snapshots it received. Coordinates are in tiles, on the layer of the player.
 */
export type ActionSubject =
  | { kind: 'tile'; x: number; y: number; tiles: Partial<Record<TileSlot, string>> }
  | {
      kind: 'entity';
      id: number;
      entity: EntityKind;
      /** Feet position. */
      x: number;
      y: number;
      /** Items on the ground: the item id. */
      item?: string;
      /** Players: their name. */
      name?: string;
    }
  | { kind: 'self' };

/** The player who acts. */
export interface Actor {
  layer: number;
  /** Feet position, in tiles. */
  x: number;
  y: number;
  inventory: Inventory;
  /** Admins may break things in the safe zone. */
  admin?: boolean;
}

/** Why an action cannot be done; shown in the menu and when the server refuses (`ui.actions.reason.*`). */
export type ActionReason =
  /** Farther than `INTERACTION.reachTiles`. */
  | 'outOfReach'
  /** No room in the inventory for what the action gives. */
  | 'inventoryFull'
  /** Another action of the player is in progress. */
  | 'busy'
  /** The last action started less than `INTERACTION.actionCooldownMs` ago. */
  | 'tooSoon'
  /** The target is no longer there. */
  | 'gone'
  /** No such action on this target. */
  | 'unavailable'
  /** Nothing is broken nor built in the safe zone around the spawn (except by an admin). */
  | 'safeZone'
  /** Something is in the way of what is placed (an object, deep water, a character). */
  | 'occupied';

/** Whether an action can be done now; when not, why. */
export type ActionCheck = { ok: true } | { ok: false; reason: ActionReason };

export interface ActionContext {
  actor: Actor;
  subject: ActionSubject;
  content: Content;
  /** Where nothing is broken; none when absent. */
  safeZone?: SafeZone;
}

/**
 * An action, the same for the client (menu, action key) and the server (which checks it again before
 * the module that owns it performs it).
 */
export interface ActionDef {
  /** Sent in `action { id }`. */
  id: string;
  /** Kinds of targets it can be aimed at. */
  targets: readonly ActionTargetKind[];
  /** Highest first in the menu; the action key does the possible one with the highest priority. */
  priority: number;
  /** How long it takes (progress bar; cancelled when the player moves), in ms. Instant when absent. */
  durationMs?: number;
  /** Label in the menu, given the name of the target (`{{name}}`). */
  labelKey: string;
  /** Also chosen by "use the item in hand" (Space, left click, Use button). */
  use?: boolean;
  /**
   * Whether the action makes sense on this subject, with what the actor holds: when not, it is not
   * listed.
   */
  appliesTo(subject: ActionSubject, content: Content, actor: Actor): boolean;
  /** Whether it can be done now; when not, it is greyed in the menu with the reason. */
  canPerform(ctx: ActionContext): ActionCheck;
}

/** Every action of the game, by id. */
export class ActionRegistry {
  /** Highest priority first; equal priorities by id. */
  readonly all: readonly ActionDef[];
  private readonly byId: ReadonlyMap<string, ActionDef>;

  constructor(defs: readonly ActionDef[]) {
    const byId = new Map<string, ActionDef>();
    for (const def of defs) {
      if (byId.has(def.id)) {
        throw new Error(`Duplicate action "${def.id}"`);
      }
      byId.set(def.id, def);
    }
    this.byId = byId;
    this.all = [...defs].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
  }

  get(id: string): ActionDef | undefined {
    return this.byId.get(id);
  }
}

/** An action offered on one subject: possible or not (`check`). */
export interface ActionOption {
  action: ActionDef;
  subject: ActionSubject;
  target: ActionTarget;
  check: ActionCheck;
}

/** The slot of the thing that names a tile: its object, otherwise its floor, otherwise its ground. */
export function thingSlot(tiles: Partial<Record<TileSlot, string>>): TileSlot | undefined {
  if (tiles.object !== undefined) {
    return 'object';
  }
  if (tiles.floor !== undefined) {
    return 'floor';
  }
  return tiles.ground === undefined ? undefined : 'ground';
}

/** The content id that names a tile: its object, otherwise its floor, otherwise its ground. */
export function tileThing(tiles: Partial<Record<TileSlot, string>>): string | undefined {
  const slot = thingSlot(tiles);
  return slot && tiles[slot];
}

/** What the client sends to aim an action at this subject. */
export function targetOf(subject: ActionSubject): ActionTarget {
  switch (subject.kind) {
    case 'tile':
      return { kind: 'tile', x: subject.x, y: subject.y };
    case 'entity':
      return { kind: 'entity', id: subject.id };
    case 'self':
      return { kind: 'self' };
  }
}

/** Whether `action` can be aimed at this subject (kind of target, and makes sense on it). */
export function actionApplies(
  action: ActionDef,
  subject: ActionSubject,
  content: Content,
  actor: Actor,
): boolean {
  return action.targets.includes(subject.kind) && action.appliesTo(subject, content, actor);
}

/**
 * Every action that applies to the subjects (the things on the aimed tile), possible or not, highest
 * priority first; at equal priority, in the order of the subjects.
 */
export function listActions(
  registry: ActionRegistry,
  actor: Actor,
  subjects: readonly ActionSubject[],
  content: Content,
  safeZone?: SafeZone,
): ActionOption[] {
  const options: ActionOption[] = [];
  for (const action of registry.all) {
    for (const subject of subjects) {
      if (actionApplies(action, subject, content, actor)) {
        const check = action.canPerform({
          actor,
          subject,
          content,
          ...(safeZone && { safeZone }),
        });
        options.push({ action, subject, target: targetOf(subject), check });
      }
    }
  }
  return options;
}

/** What the action key (E) does: the possible option with the highest priority. */
export function mainAction(options: readonly ActionOption[]): ActionOption | undefined {
  return options.find((option) => option.check.ok);
}

/**
 * What "use the item in hand" (Space, left click, Use button) does: the possible option with the highest
 * priority among the actions marked `use`. The steps that bring items to use add them (harvest, craft,
 * build, eat, fight).
 */
export function heldItemAction(options: readonly ActionOption[]): ActionOption | undefined {
  return options.find((option) => option.check.ok && option.action.use === true);
}
