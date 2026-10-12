import { PROTOCOL_VERSION } from '@8box/shared';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../store/connection';

export function ConnectionBanner() {
  const { t } = useTranslation();
  const status = useConnectionStore((state) => state.status);

  return (
    <output className={`connection-banner connection-banner--${status}`}>
      <span className="connection-banner__dot" aria-hidden="true" />
      {t(`ui.connection.${status}`)}
      <small>{t('ui.connection.protocol', { version: PROTOCOL_VERSION })}</small>
    </output>
  );
}
