import { requestWithMetadata } from '@tinacms/astro';
import client from '../../../tina/__generated__/client';

export function getArticle(path: string) {
  return requestWithMetadata(client.queries.articles({ relativePath: path }));
}

export function getPage(path: string) {
  return requestWithMetadata(client.queries.pages({ relativePath: path }));
}
