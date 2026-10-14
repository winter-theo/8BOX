import { type Content, type CreatureDef, VIEW } from '@8box/shared';
import type { RemoteView } from '../../game/world/RemoteEntities';
import { type Side, spriteSide } from '../character';
import type { EntityLayer } from './EntityLayer';

/** Sprite of a creature whose definition the client lacks (drawn as the "missing" placeholder). */
const UNKNOWN_CREATURE_SPRITE = 'creature.unknown';

/**
 * How high a creature is lifted above its feet at `timeMs`, in source pixels: hops for a creature that
 * moves by hops (slime), a small bob for the others, nothing while it stands still.
 */
export function creatureLift(
  hop: CreatureDef['hop'],
  moving: boolean,
  timeMs: number,
  view: { creatureHopPx: number; creatureBobPx: number; walkFrameMs: number } = VIEW,
): number {
  if (!moving) {
    return 0;
  }
  if (hop) {
    const phase = (timeMs % hop.moveMs) / hop.moveMs;
    return Math.round(Math.sin(phase * Math.PI) * view.creatureHopPx);
  }
  return Math.floor(timeMs / view.walkFrameMs) % 2 === 0 ? 0 : view.creatureBobPx;
}

/**
 * Draws the monsters where the interpolation puts them: the sprite of their creature, turned to their
 * side, hopping or bobbing while they move. Their hits and damage are drawn by `CombatEffects`.
 */
export class Monsters {
  /** Shown monsters and the side each one looks to. */
  private readonly shown = new Map<number, Side>();

  constructor(
    private readonly entities: EntityLayer,
    private readonly content: Content,
  ) {}

  /** Called every frame with the entities to draw. */
  update(views: readonly RemoteView[], timeMs: number): void {
    const seen = new Set<number>();
    for (const view of views) {
      if (view.kind !== 'monster') {
        continue;
      }
      seen.add(view.id);
      const side = spriteSide(view.facing, this.shown.get(view.id) ?? 'right');
      this.shown.set(view.id, side);
      const creature =
        view.creature === undefined ? undefined : this.content.creatures.get(view.creature);
      const image = this.entities.set(
        view.id,
        creature?.sprite ?? UNKNOWN_CREATURE_SPRITE,
        view,
        side === 'left',
      );
      image.y -= creatureLift(creature?.hop, view.moving, timeMs + view.id * 97);
    }
    for (const id of this.shown.keys()) {
      if (!seen.has(id)) {
        this.entities.remove(id);
        this.shown.delete(id);
      }
    }
  }
}
