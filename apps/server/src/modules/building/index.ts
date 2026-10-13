import { boxOverlapsTile, heldPlaceable, type LayerId, takeItems } from '@8box/shared';
import type { GameModule, ServerContext } from '../../core/module';

/** Farthest a character's feet can be from the center of a tile its box overlaps, in tiles. */
const OVERLAP_SEARCH_TILES = 1.5;

/** Whether a character (player, monster) other than `self` stands on tile (x, y) of a layer. */
function someoneOn(ctx: ServerContext, self: number, layer: number, x: number, y: number): boolean {
  const half = ctx.config.player.hitboxSizeTiles / 2;
  return ctx.entities.near(layer, x + 0.5, y + 0.5, OVERLAP_SEARCH_TILES).some((id) => {
    const kind = ctx.entities.typeOf(id);
    const position = ctx.entities.get(id, 'position');
    return (
      id !== self &&
      (kind === 'player' || kind === 'monster') &&
      position !== undefined &&
      boxOverlapsTile(position, half, x, y)
    );
  });
}

/**
 * Building: the "place" action puts the item in hand (an item with `place`) on the aimed tile, as the
 * tile it names, and takes one of it from the hand. `canPerform` (checked by the interaction module)
 * wants a free tile, outside the safe zone, not under the player; the server also refuses a solid tile
 * on another character. The finer rules (walls joining, doors) come with step 18.
 */
export const buildingModule: GameModule = {
  id: 'building',
  dependsOn: ['players'],
  init(ctx) {
    ctx.actions.register('place', ({ entity, subject }) => {
      const position = ctx.entities.get(entity, 'position');
      const inventory = ctx.entities.get(entity, 'inventory');
      if (!position || !inventory || subject.kind !== 'tile') {
        return 'unavailable';
      }
      const layer = position.layer as LayerId;
      const { x, y } = subject;
      const tile = heldPlaceable({ layer, x: position.x, y: position.y, inventory }, ctx.content);
      const taken = tile && takeItems(inventory, ctx.content.items, inventory.selected, 1);
      if (!tile || !taken) {
        return 'unavailable';
      }
      if (tile.solid && someoneOn(ctx, entity, layer, x, y)) {
        return 'occupied';
      }
      ctx.events.emit('inventory.set', { entity, inventory: taken.inventory });
      ctx.world.setTile(layer, x, y, tile.slot, tile.id);
      ctx.events.emit('tile.placed', { layer, x, y, slot: tile.slot, tile: tile.id, by: entity });
      return undefined;
    });
  },
};
