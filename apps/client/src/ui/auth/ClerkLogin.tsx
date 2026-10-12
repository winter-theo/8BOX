import { SignInButton, useAuth, useClerk } from '@clerk/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import { useSessionStore } from '../../store/session';

/** Joins the game with the Clerk session (a fresh token at each connection). */
function play(getToken: () => Promise<string | null>): void {
  gameClient.connect({ getToken });
}

/**
 * Connects once right after a sign-in, so that a new player goes straight to the name choice. Rendered
 * inside the ClerkProvider; draws nothing.
 */
export function ClerkAutoConnect() {
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  const status = useSessionStore((state) => state.status);
  const connectedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId || status !== 'idle') {
      return;
    }
    if (connectedFor.current !== sessionId) {
      connectedFor.current = sessionId;
      play(getToken);
    }
  }, [isLoaded, isSignedIn, sessionId, status, getToken]);
  return null;
}

/** The Google part of the login screen: sign in, or play when already signed in. */
export function ClerkLogin() {
  const { t } = useTranslation();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  if (!isLoaded) {
    return null;
  }
  return (
    <div className="login-section">
      {isSignedIn ? (
        <button type="button" onClick={() => play(getToken)}>
          {t('ui.login.play')}
        </button>
      ) : (
        <SignInButton mode="modal">
          <button type="button">{t('ui.login.google')}</button>
        </SignInButton>
      )}
    </div>
  );
}

/** Leaves the game and signs out of the Google account; shown while signed in. */
export function SignOutButton() {
  const { t } = useTranslation();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  if (!isSignedIn) {
    return null;
  }
  return (
    <button
      type="button"
      className="top-button"
      onClick={() => {
        gameClient.disconnect();
        void signOut();
      }}
    >
      {t('ui.account.signOut')}
    </button>
  );
}
