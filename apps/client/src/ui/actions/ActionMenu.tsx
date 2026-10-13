import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import { closeActionMenu, useActionsStore } from '../../store/actions';
import { subjectLabel } from './labels';

/** Space kept between the menu and the edges of the screen, in CSS pixels. */
const SCREEN_MARGIN_PX = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * The action menu of a tile (right click, long press): every action on what stands there, the
 * impossible ones greyed with the reason. A press anywhere else, Escape or walking closes it.
 */
export function ActionMenu({ touch }: { touch: boolean }) {
  const { t } = useTranslation();
  const menu = useActionsStore((state) => state.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  // Kept on screen once its size is known.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!menu || !element) {
      setPlace(null);
      return;
    }
    const { width, height } = element.getBoundingClientRect();
    setPlace({
      left: clamp(menu.left, SCREEN_MARGIN_PX, window.innerWidth - width - SCREEN_MARGIN_PX),
      top: clamp(menu.top, SCREEN_MARGIN_PX, window.innerHeight - height - SCREEN_MARGIN_PX),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        closeActionMenu();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menu]);

  if (!menu) {
    return null;
  }
  return (
    <>
      {/* Catches the press that closes the menu, so that it does not act in the world too. */}
      <button
        type="button"
        className="action-menu-backdrop"
        aria-label={t('ui.actions.close')}
        tabIndex={-1}
        onPointerDown={closeActionMenu}
        onContextMenu={(event) => {
          event.preventDefault();
          closeActionMenu();
        }}
      />
      <div
        ref={ref}
        role="menu"
        aria-label={t('ui.actions.menu')}
        className={touch ? 'action-menu action-menu--touch' : 'action-menu'}
        style={place ?? { left: menu.left, top: menu.top, visibility: 'hidden' }}
      >
        {menu.entries.map((entry, index) => (
          <button
            // Entries never move while the menu is open: their index is their identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={index}
            type="button"
            role="menuitem"
            className="action-menu-item"
            disabled={entry.reason !== null}
            onClick={() => gameClient.performAction(entry.id, entry.target)}
          >
            <span>{t(entry.labelKey, { name: subjectLabel(t, entry.name) })}</span>
            {entry.reason !== null && (
              <span className="action-menu-reason">{t(`ui.actions.reason.${entry.reason}`)}</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
