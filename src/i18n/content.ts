import { getCollection } from 'astro:content';
import type { Language, TranslationPaths } from './config';
import { localizedPath } from './config';

export async function articleTranslationPaths(translationKey: string): Promise<TranslationPaths> {
  const entries = await getCollection('articles', ({ data }) => data.translationKey === translationKey);
  return Object.fromEntries(entries.map(({ data }) => [data.language, localizedPath(data.language, `articles/${data.slug}`)]));
}
export async function getArticle(language: Language, slug: string) {
  const entries = await getCollection('articles', ({ data }) => data.language === language && data.slug === slug);
  return entries[0];
}
