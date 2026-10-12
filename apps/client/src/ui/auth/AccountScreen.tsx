import { checkPlayerName } from '@8box/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClient } from '../../game/client';
import { useSessionStore } from '../../store/session';

/** A new player picks the name everyone will see; the server checks that it is free. */
function ChooseName({ error }: { error: string | null }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const check = checkPlayerName(name);
  const shownError = name === '' ? error : check === 'ok' ? null : check;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (check === 'ok') {
      gameClient.setName(name);
    }
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h1>{t('ui.account.chooseName')}</h1>
      <p>{t('ui.account.chooseNameHint')}</p>
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
      <small className={shownError ? 'hint hint--error' : 'hint'}>
        {shownError ? t(`ui.account.nameError.${shownError}`) : t('ui.login.nameRules')}
      </small>
      <button type="submit" disabled={check !== 'ok'}>
        {t('ui.account.confirmName')}
      </button>
    </form>
  );
}

/** Signed in but not in the game: name to pick, waiting for the admin, refused or banned. */
export function AccountScreen() {
  const { t } = useTranslation();
  const account = useSessionStore((state) => state.account);
  if (!account) {
    return null;
  }
  return (
    <div className="overlay">
      {account.state === 'needsName' ? (
        <ChooseName error={account.nameError} />
      ) : (
        <div className="panel" role="status">
          <h1>{t(`ui.account.${account.state}.title`)}</h1>
          <p>{t(`ui.account.${account.state}.text`)}</p>
          {account.reason && <p>{t('ui.account.banned.reason', { reason: account.reason })}</p>}
        </div>
      )}
    </div>
  );
}
