import type { RemoteView } from '../../game/world/RemoteEntities';
import { characterFrame, characterSprite, type Side, spriteSide } from '../character';
import type { EntityLayer } from './EntityLayer';

/** Skin of every player until custom skins (P11). */
const DEFAULT_SKIN = 'default';

/**
 * Draws the other players where the interpolation puts them, walking or standing, turned to their side.
 * Other kinds of entities get drawn by the steps that bring them.
 */
export class RemotePlayers {
  /** Shown players and the side each one looks to. */
  private readonly shown = new Map<number, Side>();

  constructor(private readonly entities: EntityLayer) {}

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
      const sprite = characterSprite(DEFAULT_SKIN, characterFrame(view.moving, timeMs));
      this.entities.set(view.id, sprite, view, side === 'left');
    }
    for (const id of this.shown.keys()) {
      if (!seen.has(id)) {
        this.entities.remove(id);
        this.shown.delete(id);
      }
    }
  }
}
