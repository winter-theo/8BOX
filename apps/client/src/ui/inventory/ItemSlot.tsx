import { contentNameKey, type ItemStack, type SlotRef } from '@8box/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { spriteUrl } from '../../assets/itemIcons';
import { content } from '../../game/content';
import { inventoryActions } from './actions';
import { pressSlot } from './itemDrag';

/** Sprite of an item whose definition the client lacks. */
const UNKNOWN_ITEM_SPRITE = 'item.unknown';

/** The sprite of an item, scaled up without blur. */
export function ItemIcon({ item }: { item: string }) {
  const sprite = content.items.get(item)?.sprite ?? UNKNOWN_ITEM_SPRITE;
  return <img className="item-icon" src={spriteUrl(sprite)} alt="" draggable={false} />;
}

/** "Oak log × 12": the name of a stack, for tooltips and screen readers. */
export function useStackLabel(stack: ItemStack | null): string | undefined {
  const { t } = useTranslation();
  if (!stack) {
    return undefined;
  }
  const name = t(contentNameKey(stack.item));
  return stack.count > 1 ? t('ui.inventory.stack', { name, count: stack.count }) : name;
}

interface ItemSlotProps {
  place: SlotRef;
  stack: ItemStack | null;
  selected?: boolean;
  /** A tap (or click) that did not drag. */
  onTap?: () => void;
  /** Shown in an empty slot (key number, equipment slot name). */
  hint?: ReactNode;
  /** Name of an empty slot, for screen readers. */
  emptyLabel?: string;
}

/** A slot of the inventory: its stack, which can be dragged elsewhere or out to drop it. */
export function ItemSlot({ place, stack, selected, onTap, hint, emptyLabel }: ItemSlotProps) {
  const label = useStackLabel(stack) ?? emptyLabel;
  return (
    <div
      className={selected ? 'item-slot item-slot--selected' : 'item-slot'}
      data-slot-ref={String(place)}
      role="img"
      aria-label={label}
      title={label}
      onPointerDown={(event) =>
        pressSlot(event, place, stack, onTap ? { ...inventoryActions, onTap } : inventoryActions)
      }
      onContextMenu={(event) => event.preventDefault()}
    >
      {stack ? <ItemIcon item={stack.item} /> : hint}
      {stack && stack.count > 1 && <span className="item-count">{stack.count}</span>}
    </div>
  );
}
