import { useAuth } from '@clerk/react';
import { useCallback } from 'react';
import { readStoredDevName } from '../../devName';
import type { AuthHeader } from '../../game/adminApi';

/** Path of the admin tab. */
export const ADMIN_PATH = '/admin';

export function isAdminRoute(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === ADMIN_PATH;
}

/** Dev mode only: `Dev <name>` credentials (none for an empty name). */
export function devAuthHeaderOf(name: string): AuthHeader {
  return async () => (import.meta.env.DEV && name !== '' ? `Dev ${name}` : null);
}

/**
 * Dev mode only, on the admin page: the last dev name played on this browser when the page opened
 * (playing under another name in another tab does not change it); '' when none.
 */
export const pageDevName = import.meta.env.DEV ? readStoredDevName() : '';
export const pageDevAuthHeader: AuthHeader = devAuthHeaderOf(pageDevName);

/**
 * The admin API credentials of the signed-in Google account (a fresh Clerk token at each call), or the
 * dev credentials (`devFallback`) when no Google account is signed in. Inside the ClerkProvider only.
 */
export function useClerkAuthHeader(devFallback: AuthHeader): {
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
  return { isLoaded, isSignedIn: signedIn, header: signedIn ? bearer : devFallback };
}
