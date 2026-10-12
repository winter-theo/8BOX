import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eventBus } from '../../game/events';

/** Time the bubble stays on screen, in ms. */
const SHOWN_MS = 2000;

/**
 * Dev mode only: shows the tile of a long press on the world, where the finger was. The action menu
 * replaces it at step 15.
 */
export function LongPressBubble() {
  const { t } = useTranslation();
  const [press, setPress] = useState<{ x: number; y: number; left: number; top: number } | null>(
    null,
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = eventBus.on('world.longPress', ({ x, y, screen }) => {
      clearTimeout(timer);
      setPress({ x, y, left: screen.x, top: screen.y });
      timer = setTimeout(() => setPress(null), SHOWN_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  if (!import.meta.env.DEV || !press) {
    return null;
  }
  return (
    <div className="long-press-bubble" style={{ left: press.left, top: press.top }}>
      {t('ui.dev.longPress', { x: press.x, y: press.y })}
    </div>
  );
}
