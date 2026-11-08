import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../store/session';

/** Shown to this player alone while they are in admin mode (`/admin`). */
export function AdminModeBadge() {
  const { t } = useTranslation();
  const adminMode = useSessionStore((state) => state.adminMode);
  if (!adminMode) {
    return null;
  }
  return (
    <span className="admin-mode-badge" role="status" title={t('ui.admin.modeBadgeTitle')}>
      {t('ui.admin.modeBadge')}
    </span>
  );
}
