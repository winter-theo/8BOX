import { type ItemStack, isEquipSlot, type SlotRef } from '@8box/shared';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { create } from 'zustand';

/** The stack being dragged, drawn under the pointer by `DragGhost`; null when nothing is. */
export const useDragStore = create<{ dragged: ItemStack | null }>()(() => ({ dragged: null }));

/** Pointer travel before a press on a slot becomes a drag, in CSS pixels. */
const DRAG_THRESHOLD_PX = 6;
/** Mouse buttons that drag: left (the whole stack) and right (half of it). */
const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

/** The element that follows the pointer: moved without React, at the pointer's pace. */
let ghost: HTMLElement | null = null;
let pointer = { x: 0, y: 0 };

function placeGhost(): void {
  if (ghost) {
    ghost.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
  }
}

export function setDragGhost(element: HTMLElement | null): void {
  ghost = element;
  placeGhost();
}

/** Slot places as data attributes (`data-slot-ref`): an index or an equipment slot. */
export function parseSlotRef(value: string | undefined): SlotRef | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isEquipSlot(value)) {
    return value;
  }
  const index = Number(value);
  return value !== '' && Number.isInteger(index) && index >= 0 ? index : undefined;
}

export interface ItemDragActions {
  /** A press that did not move. */
  onTap?: () => void;
  move(from: SlotRef, to: SlotRef, count?: number): void;
  drop(from: SlotRef, count?: number): void;
}

/**
 * Follows a press on a slot (mouse or finger). Once it moves, it drags the stack (half of it with the
 * right button or Shift): released on a slot (`data-slot-ref`), the items go there; released outside
 * the inventory (`data-inventory-ui`), they are dropped in the world. A press that does not move is a
 * tap. The server decides: nothing changes here until it sends the inventory back.
 */
export function pressSlot(
  event: ReactPointerEvent,
  from: SlotRef,
  stack: ItemStack | null,
  actions: ItemDragActions,
): void {
  if (event.button !== LEFT_BUTTON && event.button !== RIGHT_BUTTON) {
    return;
  }
  const { pointerId } = event;
  const start = { x: event.clientX, y: event.clientY };
  const half = event.button === RIGHT_BUTTON || event.shiftKey;
  const count = stack && half && stack.count > 1 ? Math.ceil(stack.count / 2) : undefined;
  let dragging = false;

  const stop = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    if (dragging) {
      useDragStore.setState({ dragged: null });
    }
  };
  const onMove = (move: PointerEvent) => {
    if (move.pointerId !== pointerId) {
      return;
    }
    pointer = { x: move.clientX, y: move.clientY };
    const travel = Math.hypot(move.clientX - start.x, move.clientY - start.y);
    if (!dragging && stack && travel >= DRAG_THRESHOLD_PX) {
      dragging = true;
      useDragStore.setState({ dragged: { item: stack.item, count: count ?? stack.count } });
    }
    if (dragging) {
      placeGhost();
    }
  };
  const onUp = (up: PointerEvent) => {
    if (up.pointerId !== pointerId) {
      return;
    }
    const dragged = dragging;
    stop();
    if (!dragged) {
      actions.onTap?.();
      return;
    }
    const under = document.elementFromPoint(up.clientX, up.clientY);
    const target = parseSlotRef(under?.closest<HTMLElement>('[data-slot-ref]')?.dataset.slotRef);
    if (target !== undefined) {
      if (target !== from) {
        actions.move(from, target, count);
      }
    } else if (!under?.closest('[data-inventory-ui]')) {
      actions.drop(from, count);
    }
  };
  const onCancel = (cancel: PointerEvent) => {
    if (cancel.pointerId === pointerId) {
      stop();
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}
