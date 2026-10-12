import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../store/session';

/** Connection state, player name and ping, shown while playing or (re)connecting. */
export function ConnectionBanner() {
  const { t } = useTranslation();
  const status = useSessionStore((state) => state.status);
  const pingMs = useSessionStore((state) => state.pingMs);
  const name = useSessionStore((state) => state.player?.name);

  if (status === 'idle' || status === 'rejected') {
    return null;
  }
  return (
    <output className={`connection-banner connection-banner--${status}`}>
      <span className="connection-banner__dot" aria-hidden="true" />
      {name && <strong>{name}</strong>}
      {t(`ui.connection.${status}`)}
      {status === 'online' && pingMs !== null && (
        <small>{t('ui.connection.ping', { ms: pingMs })}</small>
      )}
    </output>
  );
}
