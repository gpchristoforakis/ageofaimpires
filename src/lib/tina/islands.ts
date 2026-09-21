import type { IslandRegistry } from '@tinacms/astro/experimental';
import ArticleBody from '../../components/tina/ArticleBody.astro';
import PageBody from '../../components/tina/PageBody.astro';
import { getArticle, getPage } from './data';

export const islands: IslandRegistry = {
  article: {
    fetch: (_request, params) => getArticle(params.get('path') ?? ''),
    component: ArticleBody,
    wrapper: { tag: 'div', className: 'tina-article-body' },
    propsFromData: (result) => ({
      data: (result as { data: { articles: unknown } }).data.articles,
    }),
  },
  page: {
    fetch: (_request, params) => getPage(params.get('path') ?? ''),
    component: PageBody,
    wrapper: { tag: 'div', className: 'tina-page-body' },
    propsFromData: (result) => ({
      data: (result as { data: { pages: unknown } }).data.pages,
    }),
  },
};
