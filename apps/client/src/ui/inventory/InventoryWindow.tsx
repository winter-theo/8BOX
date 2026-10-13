import { INVENTORY } from '@8box/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import { closeInventoryWindow, useInventoryStore } from '../../store/inventory';
import { ItemIcon, ItemSlot } from './ItemSlot';

/** Drops gold from the purse: as much as typed, at most what it holds. */
function PurseDrop({ purse }: { purse: number }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const count = Number(amount);
  const valid = Number.isInteger(count) && count > 0 && count <= purse;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) {
      gameClient.dropItems('purse', count);
      setAmount('');
    }
  };
  return (
    <form className="purse-drop" onSubmit={submit}>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={purse}
        value={amount}
        aria-label={t('ui.inventory.dropGoldAmount')}
        placeholder={t('ui.inventory.dropGoldAmount')}
        onChange={(event) => setAmount(event.target.value)}
      />
      <button type="submit" disabled={!valid}>
        {t('ui.inventory.dropGold')}
      </button>
    </form>
  );
}

/**
 * The inventory window (I, or the bag button): the hotbar and the bag slots, the equipment and the
 * purse. Stacks are dragged from slot to slot, onto an equipment slot, or out of the window to drop
 * them. It shows what the server sent: a drag changes nothing until the server answers.
 */
export function InventoryWindow({ touch }: { touch: boolean }) {
  const { t, i18n } = useTranslation();
  const open = useInventoryStore((state) => state.open);
  const inventory = useInventoryStore((state) => state.inventory);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        closeInventoryWindow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open || !inventory) {
    return null;
  }
  const { slots, equipment, purse } = inventory;
  const bagSlots = slots.slice(INVENTORY.mainSlots);
  const gold = new Intl.NumberFormat(i18n.language).format(purse);

  return (
    <section className="inventory" aria-label={t('ui.inventory.title')} data-inventory-ui>
      <header className="inventory-header">
        <h2>{t('ui.inventory.title')}</h2>
        <button
          type="button"
          className="inventory-close"
          aria-label={t('ui.inventory.close')}
          onClick={closeInventoryWindow}
        >
          ×
        </button>
      </header>
      <div className="inventory-body">
        <fieldset className="inventory-equipment" aria-label={t('ui.inventory.equipment')}>
          {INVENTORY.equipmentSlots.map((slot) => (
            <ItemSlot
              key={slot}
              place={slot}
              stack={equipment[slot] ?? null}
              emptyLabel={t(`ui.inventory.${slot}`)}
              hint={<span className="item-slot-hint">{t(`ui.inventory.${slot}`)}</span>}
            />
          ))}
        </fieldset>
        <div className="inventory-slots">
          <fieldset className="inventory-row" aria-label={t('ui.inventory.hotbar')}>
            {slots.slice(0, INVENTORY.mainSlots).map((stack, slot) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are places, their index is their identity
              <ItemSlot key={slot} place={slot} stack={stack} />
            ))}
          </fieldset>
          {bagSlots.length > 0 ? (
            <fieldset className="inventory-row" aria-label={t('ui.inventory.bagSlots')}>
              {bagSlots.map((stack, i) => (
                <ItemSlot
                  // biome-ignore lint/suspicious/noArrayIndexKey: slots are places, their index is their identity
                  key={i}
                  place={INVENTORY.mainSlots + i}
                  stack={stack}
                />
              ))}
            </fieldset>
          ) : (
            <p className="inventory-hint">{t('ui.inventory.bagHint')}</p>
          )}
          <div className="purse">
            <span className="purse-amount" title={t('ui.inventory.purse')}>
              <ItemIcon item={INVENTORY.currencyItem} />
              {t('ui.inventory.gold', { amount: gold })}
            </span>
            {purse > 0 && <PurseDrop purse={purse} />}
          </div>
        </div>
      </div>
      <p className="inventory-hint">
        {touch ? t('ui.inventory.helpTouch') : t('ui.inventory.help')}
      </p>
    </section>
  );
}
