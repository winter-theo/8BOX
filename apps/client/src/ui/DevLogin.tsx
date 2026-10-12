import { isValidPlayerName } from '@8box/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../game/client';

/** localStorage key of the last dev name used on this browser. */
const DEV_NAME_STORAGE_KEY = '8box.devName';

function readStoredName(): string {
  try {
    return localStorage.getItem(DEV_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Dev login: pick a name and play, until accounts arrive (step 11). */
export function DevLogin() {
  const { t } = useTranslation();
  const [name, setName] = useState(readStoredName);
  const valid = isValidPlayerName(name);

  const play = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) {
      return;
    }
    try {
      localStorage.setItem(DEV_NAME_STORAGE_KEY, name);
    } catch {
      // Storage disabled: the name is just not remembered.
    }
    gameClient.connect(name);
  };

  return (
    <div className="overlay">
      <form className="panel" onSubmit={play}>
        <h1>{t('ui.game.title')}</h1>
        <p>{t('ui.login.devMode')}</p>
        <label className="field">
          <span>{t('ui.login.name')}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value.trim())}
            autoComplete="nickname"
            autoCapitalize="off"
            spellCheck={false}
            // biome-ignore lint/a11y/noAutofocus: the name field is the only thing to do on this screen.
            autoFocus
          />
        </label>
        <small className={valid || name === '' ? 'hint' : 'hint hint--error'}>
          {t('ui.login.nameRules')}
        </small>
        <button type="submit" disabled={!valid}>
          {t('ui.login.play')}
        </button>
      </form>
    </div>
  );
}
