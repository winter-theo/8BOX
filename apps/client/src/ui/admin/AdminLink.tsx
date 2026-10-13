import { ADMIN } from '@8box/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVER_URL } from '../../env';
import { AdminApi, type AuthHeader, failureOf } from '../../game/adminApi';
import { useSessionStore } from '../../store/session';
import { ADMIN_PATH, devAuthHeader, useClerkAuthHeader } from './adminAuth';

/**
 * Link to the admin tab, with the number of pending requests; shown to admins only (the server
 * answers `/admin/me` for them alone). The count is refreshed every 30 s.
 */
function AdminLink({ authHeader }: { authHeader: AuthHeader }) {
  const { t } = useTranslation();
  /** Null while unknown, or for a player who is not an admin. */
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    const api = new AdminApi(SERVER_URL, authHeader);
    let active = true;
    const load = () =>
      api.me().then(
        (me) => {
          if (active) {
            setPending(me.pendingCount);
          }
        },
        (error: unknown) => {
          const failure = failureOf(error);
          if (failure === 'unauthorized' || failure === 'forbidden') {
            clearInterval(timer); // Not an admin: no need to ask again.
            if (active) {
              setPending(null);
            }
          }
        },
      );
    const timer = setInterval(load, ADMIN.refreshIntervalMs);
    void load();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [authHeader]);

  if (pending === null) {
    return null;
  }
  const badge = t('ui.admin.pendingBadge', { count: pending });
  return (
    <a
      className="top-button"
      href={ADMIN_PATH}
      aria-label={pending > 0 ? `${t('ui.admin.link')} · ${badge}` : undefined}
    >
      {t('ui.admin.link')}
      {pending > 0 && (
        <span className="badge" title={badge}>
          {pending}
        </span>
      )}
    </a>
  );
}

/** Asks again whether the player is an admin when they join the game under another name. */
function usePlayerName(): string {
  return useSessionStore((state) => state.player?.name ?? '');
}

/** The admin link for the signed-in Google account (or the dev name in dev mode). */
export function ClerkAdminLink() {
  const { isLoaded, isSignedIn, header } = useClerkAuthHeader();
  const name = usePlayerName();
  return isLoaded ? <AdminLink key={`${isSignedIn}:${name}`} authHeader={header} /> : null;
}

/** The admin link without Clerk: dev names only. */
export function DevAdminLink() {
  return <AdminLink key={usePlayerName()} authHeader={devAuthHeader} />;
}
