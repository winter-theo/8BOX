import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

/** Screen orientation lock: in the browsers that support it (Android, in full screen). */
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

async function enterFullscreen(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await (screen.orientation as LockableOrientation).lock?.('landscape');
  } catch {
    // Refused or not supported (iPhone): the game still works in the browser.
  }
}

/** Puts the game in full screen and locks landscape when the browser allows it; hidden otherwise. */
export function FullscreenButton() {
  const { t } = useTranslation();
  const fullscreen = useSyncExternalStore(subscribe, () => document.fullscreenElement !== null);

  if (!document.fullscreenEnabled || fullscreen) {
    return null;
  }
  return (
    <button type="button" className="fullscreen-button" onClick={() => void enterFullscreen()}>
      {t('ui.mobile.fullscreen')}
    </button>
  );
}
