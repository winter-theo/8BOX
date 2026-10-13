import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import { useSurvivalStore } from '../../store/survival';

/** "You died", with what killed the player and a button to respawn (at their bed or the spawn). */
export function DeathScreen() {
  const { t } = useTranslation();
  const dead = useSurvivalStore((state) => state.dead);

  if (dead === null) {
    return null;
  }
  return (
    <div className="overlay death-screen">
      <div className="panel" role="alertdialog" aria-labelledby="death-title">
        <h2 id="death-title">{t('ui.death.title')}</h2>
        <p>{t(`ui.death.${dead}`)}</p>
        {/* biome-ignore lint/a11y/noAutofocus: the only thing to do on this screen */}
        <button type="button" autoFocus onClick={() => gameClient.respawn()}>
          {t('ui.death.respawn')}
        </button>
      </div>
    </div>
  );
}
