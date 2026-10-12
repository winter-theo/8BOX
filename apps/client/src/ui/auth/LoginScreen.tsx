import { useTranslation } from 'react-i18next';
import { CLERK_PUBLISHABLE_KEY } from '../../env';
import { DevLoginForm } from '../DevLogin';
import { ClerkLogin } from './ClerkLogin';

/** Welcome screen: sign in with Google, or (dev mode) play with a simple name. */
export function LoginScreen() {
  const { t } = useTranslation();
  return (
    <div className="overlay">
      <div className="panel">
        <h1>{t('ui.game.title')}</h1>
        {CLERK_PUBLISHABLE_KEY ? (
          <ClerkLogin />
        ) : (
          !import.meta.env.DEV && <p>{t('ui.login.unavailable')}</p>
        )}
        {import.meta.env.DEV && <DevLoginForm />}
      </div>
    </div>
  );
}
