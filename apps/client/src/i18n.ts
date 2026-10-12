import {
  DEFAULT_LANGUAGE,
  i18nResources,
  LANGUAGES,
  type Language,
  resolveLanguage,
} from '@8box/shared';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

/** localStorage key of the language chosen by the player. */
const LANGUAGE_STORAGE_KEY = '8box.language';

function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null; // Storage disabled (private mode…): fall back to the browser language.
  }
}

/** Starts i18next with the stored language, else the browser language, else French. */
export function initI18n(): void {
  const language = resolveLanguage([readStoredLanguage(), ...navigator.languages]);
  void i18next.use(initReactI18next).init({
    resources: i18nResources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes.
    initAsync: false,
  });
  document.documentElement.lang = language;
}

/** Switches the interface language and remembers it for the next visits. */
export function setLanguage(language: Language): void {
  void i18next.changeLanguage(language);
  document.documentElement.lang = language;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage disabled: the choice only lasts for this visit.
  }
}
