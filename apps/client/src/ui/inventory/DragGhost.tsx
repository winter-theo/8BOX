import { ItemIcon } from './ItemSlot';
import { setDragGhost, useDragStore } from './itemDrag';

/** The stack being dragged, under the pointer (moved by the drag itself, not by React). */
export function DragGhost() {
  const dragged = useDragStore((state) => state.dragged);
  if (!dragged) {
    return null;
  }
  return (
    <div className="drag-ghost" ref={setDragGhost} aria-hidden="true">
      <ItemIcon item={dragged.item} />
      {dragged.count > 1 && <span className="item-count">{dragged.count}</span>}
    </div>
  );
}
