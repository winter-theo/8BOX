import { isValidPlayerName } from '@8box/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readStoredDevName, storeDevName } from '../devName';
import { gameClient } from '../game/client';

/** Dev mode only: play with a simple name, without an account (bots, tests, several tabs). */
export function DevLoginForm() {
  const { t } = useTranslation();
  const [name, setName] = useState(readStoredDevName);
  const valid = isValidPlayerName(name);

  const play = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) {
      return;
    }
    storeDevName(name);
    gameClient.connect({ devName: name });
  };

  return (
    <form className="login-section" onSubmit={play}>
      <p>{t('ui.login.devMode')}</p>
      <label className="field">
        <span>{t('ui.login.name')}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value.trim())}
          autoComplete="nickname"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      <small className={valid || name === '' ? 'hint' : 'hint hint--error'}>
        {t('ui.login.nameRules')}
      </small>
      <button type="submit" disabled={!valid}>
        {t('ui.login.play')}
      </button>
    </form>
  );
}
