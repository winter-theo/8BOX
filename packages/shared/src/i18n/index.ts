import en from './en.json' with { type: 'json' };
import fr from './fr.json' with { type: 'json' };

export const LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'fr';

/** Translations of every language, in the i18next `resources` format (one `translation` namespace). */
export const i18nResources = {
  fr: { translation: fr },
  en: { translation: en },
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * First supported language among the candidates, in order (`en-US` counts as `en`);
 * the default language when none is supported.
 */
export function resolveLanguage(candidates: readonly (string | null | undefined)[]): Language {
  for (const candidate of candidates) {
    const base = candidate?.toLowerCase().split('-')[0];
    if (isLanguage(base)) {
      return base;
    }
  }
  return DEFAULT_LANGUAGE;
}

/** i18n key of a content entry name: `base:oak_log` → `content.base.oak_log.name`. */
export function contentNameKey(id: string): string {
  return `content.${id.replace(':', '.')}.name`;
}
