import {
  boxOverlapsTile,
  doorMeta,
  heldPlaceable,
  type LayerId,
  takeItems,
  tileTarget,
} from '@8box/shared';
import type { PerformAction } from '../../core/actions';
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
 * Building: "place" puts the item in hand (an item with `place`) on the aimed tile, as the tile it
 * names, and takes one of it from the hand. `canPerform` (checked by the interaction module) wants a
 * free tile in reach, outside the safe zone, not under the player; the server also refuses a solid tile
 * on another character. Then what was built is used: a door opens and closes (its state is in the meta
 * of its tile, which the clients receive), and sleeping in a bed makes it the player's spawn point
 * (saved with the character, used when they die from step 20). Placing a construction, or breaking one
 * (a tile some item places), marks its chunk `has_player_build`.
 */
export const buildingModule: GameModule = {
  id: 'building',
  dependsOn: ['players'],
  init(ctx) {
    /** Tiles that players build: the ones some item places. */
    const built = new Set(
      ctx.content.items.all.flatMap((item) => (item.place === undefined ? [] : [item.place])),
    );

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
      ctx.world.markPlayerBuild(layer, x, y);
      ctx.events.emit('tile.placed', { layer, x, y, slot: tile.slot, tile: tile.id, by: entity });
      return undefined;
    });

    /** Opens (`open`) or closes the aimed door; closing it on another character is refused. */
    const setDoor =
      (open: boolean): PerformAction =>
      ({ entity, subject }) => {
        const position = ctx.entities.get(entity, 'position');
        if (!position || subject.kind !== 'tile' || !tileTarget(subject, ctx.content)?.tile.door) {
          return 'unavailable';
        }
        const layer = position.layer as LayerId;
        if (!open && someoneOn(ctx, entity, layer, subject.x, subject.y)) {
          return 'occupied';
        }
        ctx.world.setMeta(layer, subject.x, subject.y, doorMeta(open));
        return undefined;
      };
    ctx.actions.register('openDoor', setDoor(true));
    ctx.actions.register('closeDoor', setDoor(false));

    ctx.actions.register('sleep', ({ entity, subject }) => {
      const position = ctx.entities.get(entity, 'position');
      if (!position || subject.kind !== 'tile' || !tileTarget(subject, ctx.content)?.tile.bed) {
        return 'unavailable';
      }
      ctx.entities.set(entity, 'spawnPoint', { layer: position.layer, x: subject.x, y: subject.y });
      return undefined;
    });

    ctx.events.on('tile.broken', ({ layer, x, y, tile }) => {
      if (built.has(tile)) {
        ctx.world.markPlayerBuild(layer, x, y);
      }
    });
  },
};
