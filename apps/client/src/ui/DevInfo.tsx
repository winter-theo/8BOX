import { contentNameKey } from '@8box/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../game/client';
import { content } from '../game/content';
import { useSessionStore } from '../store/session';
import { useTouchMode } from './useTouchMode';

/** Dev mode only, until the `/give` command (step 24): gives items to oneself. */
function DevGive() {
  const { t } = useTranslation();
  const [item, setItem] = useState(content.items.all[0]?.id ?? '');
  const [count, setCount] = useState('10');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(count);
    if (item && Number.isInteger(amount) && amount > 0) {
      gameClient.devGive(item, amount);
    }
  };
  return (
    <form className="dev-give" onSubmit={submit}>
      <select
        aria-label={t('ui.dev.giveItem')}
        value={item}
        onChange={(event) => setItem(event.target.value)}
      >
        {content.items.all.map(({ id }) => (
          <option key={id} value={id}>
            {t(contentNameKey(id))}
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        aria-label={t('ui.dev.giveCount')}
        value={count}
        onChange={(event) => setCount(event.target.value)}
      />
      <button type="submit">{t('ui.dev.give')}</button>
    </form>
  );
}

/** Dev mode only: FPS, zoom, streamed chunks and objects, positions, keyboard controls, items to give. */
export function DevInfo() {
  const { t } = useTranslation();
  const online = useSessionStore((state) => state.status === 'online');
  const loadedChunks = useSessionStore((state) => state.loadedChunks);
  const player = useSessionStore((state) => state.playerPosition);
  const camera = useSessionStore((state) => state.debugCamera);
  const stats = useSessionStore((state) => state.debugStats);
  const touch = useTouchMode();

  if (!import.meta.env.DEV || !online) {
    return null;
  }
  return (
    <aside className="dev-info">
      {stats && <span>{t('ui.dev.stats', { ...stats })}</span>}
      <span>{t('ui.dev.chunks', { count: loadedChunks })}</span>
      {player && (
        <span>{t('ui.dev.player', { x: player.x.toFixed(2), y: player.y.toFixed(2) })}</span>
      )}
      {camera && (
        <span>{t('ui.dev.camera', { x: Math.floor(camera.x), y: Math.floor(camera.y) })}</span>
      )}
      {!touch && <span>{t('ui.dev.controls')}</span>}
      {!touch && <span>{t('ui.dev.inventoryControls')}</span>}
      <DevGive />
    </aside>
  );
}
