import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../store/session';

/** Dev mode only: streamed chunk count, debug camera position and controls. */
export function DevInfo() {
  const { t } = useTranslation();
  const online = useSessionStore((state) => state.status === 'online');
  const loadedChunks = useSessionStore((state) => state.loadedChunks);
  const camera = useSessionStore((state) => state.debugCamera);

  if (!import.meta.env.DEV || !online) {
    return null;
  }
  return (
    <aside className="dev-info">
      <span>{t('ui.dev.chunks', { count: loadedChunks })}</span>
      {camera && (
        <span>{t('ui.dev.camera', { x: Math.floor(camera.x), y: Math.floor(camera.y) })}</span>
      )}
      <span>{t('ui.dev.controls')}</span>
    </aside>
  );
}
