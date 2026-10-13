import { isSkin, PLAYER } from '@8box/shared';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../game/client';
import { useSessionStore } from '../store/session';

/** Picks the skin of the player's character; it shows the skin the server confirmed. */
export function SkinSelect() {
  const { t } = useTranslation();
  const skin = useSessionStore((state) => state.player?.skin);

  if (skin === undefined) {
    return null;
  }
  return (
    <label className="skin-select">
      <span className="visually-hidden">{t('ui.skin.label')}</span>
      <select
        value={skin}
        onChange={(event) => {
          if (isSkin(event.target.value)) {
            gameClient.setSkin(event.target.value);
          }
        }}
      >
        {PLAYER.skins.map((option) => (
          <option key={option} value={option}>
            {t(`ui.skin.${option}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
