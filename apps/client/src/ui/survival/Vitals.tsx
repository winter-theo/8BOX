import { SURVIVAL } from '@8box/shared';
import { useTranslation } from 'react-i18next';
import { spriteUrl } from '../../assets/itemIcons';
import { useSurvivalStore } from '../../store/survival';

/** Points shown by one icon of a gauge (a heart is 2 HP, a drumstick 2 hunger points). */
const POINTS_PER_ICON = 2;

/** Sprite of icon `index` of a gauge at `value`: full, half or empty. */
export function gaugeIcon(sprite: string, value: number, index: number): string {
  const left = value - index * POINTS_PER_ICON;
  const state = left >= POINTS_PER_ICON ? 'full' : left > 0 ? 'half' : 'empty';
  return `${sprite}.${state}`;
}

function Gauge({
  sprite,
  value,
  max,
  label,
}: {
  sprite: string;
  value: number;
  max: number;
  label: string;
}) {
  const icons = Math.ceil(max / POINTS_PER_ICON);
  return (
    <div className="vitals-gauge" role="img" aria-label={label} title={label}>
      {Array.from({ length: icons }, (_, index) => (
        <img
          // Icons are places of the gauge: their index is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          key={index}
          className="vitals-icon"
          src={spriteUrl(gaugeIcon(sprite, value, index))}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}

/** Hearts (health) and drumsticks (hunger) above the item bar, on computer and phone. */
export function Vitals() {
  const { t } = useTranslation();
  const health = useSurvivalStore((state) => state.health);
  const hunger = useSurvivalStore((state) => state.hunger);

  if (health === null || hunger === null) {
    return null;
  }
  return (
    <div className="vitals">
      <Gauge
        sprite="hud.heart"
        value={health}
        max={SURVIVAL.maxHealth}
        label={t('ui.vitals.health', { value: health, max: SURVIVAL.maxHealth })}
      />
      <Gauge
        sprite="hud.hunger"
        value={hunger}
        max={SURVIVAL.maxHunger}
        label={t('ui.vitals.hunger', { value: hunger, max: SURVIVAL.maxHunger })}
      />
    </div>
  );
}
