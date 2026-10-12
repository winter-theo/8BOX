import { useTranslation } from 'react-i18next';
import { gameClient } from '../game/client';
import { useSessionStore } from '../store/session';

/** Why the server refused the session; an outdated client is offered to reload. */
export function RejectedScreen() {
  const { t } = useTranslation();
  const reason = useSessionStore((state) => state.rejectReason);

  return (
    <div className="overlay">
      <div className="panel" role="alert">
        <p>{t(`ui.rejected.${reason ?? 'unavailable'}`)}</p>
        {reason === 'outdated' ? (
          <button type="button" onClick={() => window.location.reload()}>
            {t('ui.rejected.reload')}
          </button>
        ) : (
          <button type="button" onClick={() => gameClient.disconnect()}>
            {t('ui.rejected.back')}
          </button>
        )}
      </div>
    </div>
  );
}
