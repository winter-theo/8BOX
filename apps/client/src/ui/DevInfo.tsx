import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../store/session';

/** Dev mode only: FPS, zoom, streamed chunks and objects, test character position and controls. */
export function DevInfo() {
  const { t } = useTranslation();
  const online = useSessionStore((state) => state.status === 'online');
  const loadedChunks = useSessionStore((state) => state.loadedChunks);
  const camera = useSessionStore((state) => state.debugCamera);
  const stats = useSessionStore((state) => state.debugStats);

  if (!import.meta.env.DEV || !online) {
    return null;
  }
  return (
    <aside className="dev-info">
      {stats && <span>{t('ui.dev.stats', { ...stats })}</span>}
      <span>{t('ui.dev.chunks', { count: loadedChunks })}</span>
      {camera && (
        <span>{t('ui.dev.camera', { x: Math.floor(camera.x), y: Math.floor(camera.y) })}</span>
      )}
      <span>{t('ui.dev.controls')}</span>
    </aside>
  );
}
