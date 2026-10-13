import { DEFAULT_SKIN } from '@8box/shared';
import type { RemoteView } from '../../game/world/RemoteEntities';
import { characterFrame, characterSprite, type Side, spriteSide } from '../character';
import type { EntityLayer } from './EntityLayer';
import type { NameLabels } from './NameLabels';

/**
 * Draws the other players where the interpolation puts them, in their skin, walking or standing, turned
 * to their side, with their name above their head.
 * Other kinds of entities get drawn by the steps that bring them.
 */
export class RemotePlayers {
  /** Shown players and the side each one looks to. */
  private readonly shown = new Map<number, Side>();

  constructor(
    private readonly entities: EntityLayer,
    private readonly labels: NameLabels,
  ) {}

  /** Called every frame with the entities to draw. */
  update(views: readonly RemoteView[], timeMs: number): void {
    const seen = new Set<number>();
    for (const view of views) {
      if (view.kind !== 'player') {
        continue;
      }
      seen.add(view.id);
      const side = spriteSide(view.facing, this.shown.get(view.id) ?? 'right');
      this.shown.set(view.id, side);
      const skin = view.skin ?? DEFAULT_SKIN;
      const sprite = characterSprite(skin, characterFrame(view.moving, timeMs));
      const image = this.entities.set(view.id, sprite, view, side === 'left');
      if (view.name !== undefined) {
        this.labels.set(view.id, view.name, { x: image.x, y: image.y - image.height });
      }
    }
    for (const id of this.shown.keys()) {
      if (!seen.has(id)) {
        this.entities.remove(id);
        this.labels.remove(id);
        this.shown.delete(id);
      }
    }
  }
}
