import { useTranslation } from 'react-i18next';
import { spriteUrl } from '../../assets/itemIcons';
import { useClockStore } from '../../store/clock';

/** "06:05": hours and minutes on two digits. */
export function formatClock(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Small clock of the world time: the sun by day, the moon at night, and the hour. */
export function Clock() {
  const { t } = useTranslation();
  const clock = useClockStore((state) => state.clock);

  if (!clock) {
    return null;
  }
  const time = formatClock(clock.hours, clock.minutes);
  const label = t(clock.daytime ? 'ui.clock.day' : 'ui.clock.night', { time });
  return (
    <div className="clock" role="img" aria-label={label} title={label}>
      <img
        className="clock-icon"
        src={spriteUrl(clock.daytime ? 'hud.sun' : 'hud.moon')}
        alt=""
        draggable={false}
      />
      <span>{time}</span>
    </div>
  );
}
