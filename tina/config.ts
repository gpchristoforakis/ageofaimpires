import { defineConfig } from 'tinacms';

const branch =
  process.env.TINA_BRANCH ||
  process.env.CF_PAGES_BRANCH ||
  process.env.HEAD ||
  'main';

const textField = (name: string, label: string) => ({
  type: 'string' as const,
  name,
  label,
});

export default defineConfig({
  branch,
  clientId: process.env.PUBLIC_TINA_CLIENT_ID || null,
  token: process.env.TINA_TOKEN || null,
  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },
  media: {
    tina: {
      mediaRoot: 'images',
      publicFolder: 'public',
    },
  },
  schema: {
    collections: [
      {
        name: 'articles',
        label: 'Articles',
        path: 'src/content/articles',
        format: 'mdx',
        fields: [
          {
            ...textField('language', 'Language'),
            options: ['en', 'el'],
          },
          textField('translationKey', 'Translation key'),
          textField('routeSlug', 'Route slug'),
          textField('title', 'Title'),
          textField('description', 'Description'),
          textField('kicker', 'Kicker'),
          textField('heading', 'Heading'),
          textField('intro', 'Introduction'),
          textField('readTime', 'Read time'),
          {
            type: 'rich-text',
            name: 'body',
            label: 'Article body',
            isBody: true,
          },
        ],
      },
      {
        name: 'frameworks',
        label: 'Frameworks',
        path: 'src/content/frameworks',
        fields: [
          {
            ...textField('language', 'Language'),
            options: ['en', 'el'],
          },
          textField('translationKey', 'Translation key'),
          {
            type: 'number',
            name: 'order',
            label: 'Order',
          },
          textField('label', 'Label'),
          textField('title', 'Title'),
          {
            type: 'boolean',
            name: 'featured',
            label: 'Featured',
          },
          textField('formula', 'Formula'),
          textField('formulaNote', 'Formula note'),
          textField('pullquote', 'Pull quote'),
          {
            type: 'rich-text',
            name: 'body',
            label: 'Framework body',
            isBody: true,
          },
        ],
      },
      {
        name: 'notebook',
        label: 'Notebook',
        path: 'src/content/notebook',
        fields: [
          {
            ...textField('language', 'Language'),
            options: ['en', 'el'],
          },
          textField('translationKey', 'Translation key'),
          {
            type: 'number',
            name: 'order',
            label: 'Order',
          },
          textField('type', 'Type'),
          textField('title', 'Title'),
          {
            type: 'rich-text',
            name: 'body',
            label: 'Notebook body',
            isBody: true,
          },
        ],
      },
      {
        name: 'pages',
        label: 'Pages',
        path: 'src/content/pages',
        fields: [
          {
            ...textField('language', 'Language'),
            options: ['en', 'el'],
          },
          textField('translationKey', 'Translation key'),
          textField('title', 'Title'),
          textField('description', 'Description'),
          textField('label', 'Label'),
          textField('heading', 'Heading'),
          textField('intro', 'Introduction'),
          {
            type: 'rich-text',
            name: 'body',
            label: 'Page body',
            isBody: true,
          },
        ],
      },
    ],
  },
});
