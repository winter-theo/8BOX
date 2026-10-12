import { useTranslation } from 'react-i18next';
import { FullscreenButton } from './FullscreenButton';

/** Shown over the game on a phone held upright: 8Box is played in landscape. */
export function RotatePhone() {
  const { t } = useTranslation();
  return (
    <div className="overlay rotate-phone" role="alert">
      <div className="panel">
        <h1>{t('ui.mobile.rotate')}</h1>
        <p>{t('ui.mobile.rotateHint')}</p>
        <FullscreenButton />
      </div>
    </div>
  );
}
