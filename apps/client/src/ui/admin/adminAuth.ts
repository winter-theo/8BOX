import { useAuth } from '@clerk/react';
import { useCallback } from 'react';
import { readStoredDevName } from '../../devName';
import type { AuthHeader } from '../../game/adminApi';

/** Path of the admin tab. */
export const ADMIN_PATH = '/admin';

export function isAdminRoute(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === ADMIN_PATH;
}

/** Dev mode only: `Dev <name>` with the last dev name played on this browser. */
export const devAuthHeader: AuthHeader = async () => {
  const name = readStoredDevName();
  return import.meta.env.DEV && name !== '' ? `Dev ${name}` : null;
};

/**
 * The admin API credentials of the signed-in Google account (a fresh Clerk token at each call), or the
 * dev name in dev mode when no Google account is signed in. Inside the ClerkProvider only.
 */
export function useClerkAuthHeader(): {
  isLoaded: boolean;
  isSignedIn: boolean;
  header: AuthHeader;
} {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const signedIn = isSignedIn === true;
  const bearer = useCallback(async () => {
    const token = await getToken();
    return token === null ? null : `Bearer ${token}`;
  }, [getToken]);
  return { isLoaded, isSignedIn: signedIn, header: signedIn ? bearer : devAuthHeader };
}
