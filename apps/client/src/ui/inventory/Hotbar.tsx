import { INVENTORY } from '@8box/shared';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import { useInventoryStore } from '../../store/inventory';
import { ItemSlot } from './ItemSlot';

/** Key of each hotbar slot: 1 to 9, then 0. */
const keyOf = (slot: number) => String((slot + 1) % INVENTORY.mainSlots);

/**
 * The item bar at the bottom: the first 10 slots of the inventory. A tap (or 1 to 0, the wheel) puts
 * the item of a slot in hand; its stacks can be dragged like in the inventory window.
 */
export function Hotbar({ touch }: { touch: boolean }) {
  const { t } = useTranslation();
  const slots = useInventoryStore((state) => state.inventory?.slots);
  const selected = useInventoryStore((state) => state.inventory?.selected);

  if (!slots) {
    return null;
  }
  return (
    <nav className="hotbar" aria-label={t('ui.inventory.hotbar')} data-inventory-ui>
      {slots.slice(0, INVENTORY.mainSlots).map((stack, slot) => (
        <ItemSlot
          // Slots are places: their index is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          key={slot}
          place={slot}
          stack={stack}
          selected={slot === selected}
          onTap={() => gameClient.selectSlot(slot)}
          hint={touch ? undefined : <span className="item-slot-key">{keyOf(slot)}</span>}
        />
      ))}
    </nav>
  );
}
