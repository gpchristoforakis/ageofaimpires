export const languages = ['en', 'el'] as const;
export type Language = (typeof languages)[number];

export const defaultLanguage: Language = 'en';

export const languageNames: Record<Language, string> = {
  en: 'EN',
  el: 'ΕΛ',
};

export function isLanguage(value: string | undefined): value is Language {
  return languages.includes(value as Language);
}

export function localizedPath(language: Language, path = '/') {
  const normalized = path === '/' ? '' : `/${path.replace(/^\/+|\/+$/g, '')}`;
  return `/${language}${normalized}/`;
}

export type TranslationPaths = Partial<Record<Language, string>>;

export const staticTranslationPaths = {
  home: { en: '/en/', el: '/el/' },
  articles: { en: '/en/articles/', el: '/el/articles/' },
  frameworks: { en: '/en/frameworks/' },
  notebook: { en: '/en/notebook/' },
  about: { en: '/en/about/' },
} satisfies Record<string, TranslationPaths>;
