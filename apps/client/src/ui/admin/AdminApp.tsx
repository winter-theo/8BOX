import { SignInButton } from '@clerk/react';
import { useTranslation } from 'react-i18next';
import { readStoredDevName } from '../../devName';
import { CLERK_PUBLISHABLE_KEY } from '../../env';
import { LanguageSelect } from '../LanguageSelect';
import { AdminPage } from './AdminPage';
import { devAuthHeader, useClerkAuthHeader } from './adminAuth';

/** With Clerk: the admin tab of the signed-in Google account, or a sign-in button. */
function ClerkAdminGate() {
  const { t } = useTranslation();
  const { isLoaded, isSignedIn, header } = useClerkAuthHeader();

  if (!isLoaded) {
    return <p className="admin-notice">{t('ui.admin.loading')}</p>;
  }
  // In dev mode, without a Google account, the last dev name of this browser is used.
  const devName = import.meta.env.DEV ? readStoredDevName() : '';
  if (!isSignedIn && devName === '') {
    return (
      <div className="admin-notice">
        <p>{t('ui.admin.signIn')}</p>
        <SignInButton mode="modal">
          <button type="button" className="admin-button admin-button--primary">
            {t('ui.admin.signInButton')}
          </button>
        </SignInButton>
      </div>
    );
  }
  return <AdminPage key={String(isSignedIn)} authHeader={header} />;
}

/** The `/admin` page: a normal scrolling page, outside the game. */
export function AdminApp() {
  const { t } = useTranslation();

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>
          8Box <small>· {t('ui.admin.title')}</small>
        </h1>
        <nav className="admin-header__nav">
          <a className="top-button" href="/">
            {t('ui.admin.backToGame')}
          </a>
          <LanguageSelect />
        </nav>
      </header>
      <main>
        {CLERK_PUBLISHABLE_KEY ? <ClerkAdminGate /> : <AdminPage authHeader={devAuthHeader} />}
      </main>
    </div>
  );
}
