import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../game/client';
import { useSessionStore } from '../store/session';

/** How often the countdown is redrawn, in ms. */
const COUNTDOWN_REFRESH_MS = 250;
const SECOND_MS = 1000;

/**
 * Shown while the connection is lost: the server is off or restarting. The client tries again by itself
 * (with a growing delay); the button tries at once.
 */
export function ServerUnavailableScreen() {
  const { t } = useTranslation();
  const retryAt = useSessionStore((state) => state.retryAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const seconds = retryAt === null ? 0 : Math.ceil((retryAt - now) / SECOND_MS);
  const waiting = seconds > 0;
  return (
    <div className="overlay">
      <div className="panel" role="alert">
        <h1>{t('ui.unavailable.title')}</h1>
        <p>{t('ui.unavailable.text')}</p>
        <p aria-live="polite">
          {waiting ? t('ui.unavailable.retryIn', { seconds }) : t('ui.unavailable.retrying')}
        </p>
        <button type="button" disabled={!waiting} onClick={() => gameClient.retryNow()}>
          {t('ui.unavailable.retryNow')}
        </button>
      </div>
    </div>
  );
}
