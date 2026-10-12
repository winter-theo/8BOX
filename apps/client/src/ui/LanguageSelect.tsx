import { isLanguage, LANGUAGES } from '@8box/shared';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';

export function LanguageSelect() {
  const { t, i18n } = useTranslation();

  return (
    <label className="language-select">
      <span className="visually-hidden">{t('ui.language.label')}</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={(event) => {
          if (isLanguage(event.target.value)) {
            setLanguage(event.target.value);
          }
        }}
      >
        {LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {t(`ui.language.${language}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
