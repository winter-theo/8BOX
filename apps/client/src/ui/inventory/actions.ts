import { gameClient } from '../../game/client';
import type { ItemDragActions } from './itemDrag';

/** What a drag asks the server: move the items, or drop them in the world. */
export const inventoryActions: ItemDragActions = {
  move: (from, to, count) => gameClient.moveItems(from, to, count),
  drop: (from, count) => gameClient.dropItems(from, count),
};
