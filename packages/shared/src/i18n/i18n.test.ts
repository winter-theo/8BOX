import { describe, expect, it } from 'vitest';
import { baseContent } from '../content/base';
import { loadContent } from '../content/load';
import en from './en.json' with { type: 'json' };
import fr from './fr.json' with { type: 'json' };
import { contentNameKey, DEFAULT_LANGUAGE, resolveLanguage } from './index';

type Translations = { [key: string]: string | Translations };

/** Flattens nested translations into `{ 'ui.connection.online': 'Connecté', … }`. */
function flatten(tree: Translations, prefix = ''): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      for (const [subKey, subValue] of flatten(value, path)) {
        result.set(subKey, subValue);
      }
    } else {
      result.set(path, value);
    }
  }
  return result;
}

const languages = { fr: flatten(fr), en: flatten(en) };

function placeholders(text: unknown): string[] {
  return [...String(text).matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1] ?? '').sort();
}

describe('translations', () => {
  it('have exactly the same keys in French and English', () => {
    expect([...languages.en.keys()].sort()).toEqual([...languages.fr.keys()].sort());
  });

  it('are non-empty strings', () => {
    for (const [language, entries] of Object.entries(languages)) {
      for (const [key, value] of entries) {
        expect(typeof value === 'string' && value.trim().length > 0, `${language}: ${key}`).toBe(
          true,
        );
      }
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, value] of languages.fr) {
      expect(placeholders(languages.en.get(key)), key).toEqual(placeholders(value));
    }
  });

  it('name every tile and every item in both languages', () => {
    const content = loadContent(baseContent);
    const ids = [...content.tiles.all, ...content.items.all].map((entry) => entry.id);
    for (const id of ids) {
      for (const [language, entries] of Object.entries(languages)) {
        expect(entries.has(contentNameKey(id)), `${language}: ${contentNameKey(id)}`).toBe(true);
      }
    }
  });
});

describe('contentNameKey', () => {
  it('turns a namespaced id into an i18n key', () => {
    expect(contentNameKey('base:oak_log')).toBe('content.base.oak_log.name');
  });
});

describe('resolveLanguage', () => {
  it('returns the first supported candidate, ignoring the region', () => {
    expect(resolveLanguage(['en-US', 'fr'])).toBe('en');
    expect(resolveLanguage([null, 'de-DE', 'FR-ca'])).toBe('fr');
  });

  it('falls back to French', () => {
    expect(DEFAULT_LANGUAGE).toBe('fr');
    expect(resolveLanguage(['de', 'es-ES'])).toBe('fr');
    expect(resolveLanguage([])).toBe('fr');
  });
});
