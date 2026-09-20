import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    language: z.enum(['en', 'el']),
    translationKey: z.string(),
    routeSlug: z.string(),
    title: z.string(),
    description: z.string(),
    kicker: z.string(),
    heading: z.string(),
    intro: z.string(),
    readTime: z.string(),
  }),
});

const frameworks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/frameworks' }),
  schema: z.object({
    language: z.enum(['en', 'el']),
    translationKey: z.string(),
    order: z.number(),
    label: z.string(),
    title: z.string(),
    featured: z.boolean().default(false),
    formula: z.string().optional(),
    formulaNote: z.string().optional(),
    pullquote: z.string().optional(),
  }),
});

const notebook = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notebook' }),
  schema: z.object({
    language: z.enum(['en', 'el']),
    translationKey: z.string(),
    order: z.number(),
    type: z.string(),
    title: z.string(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    language: z.enum(['en', 'el']),
    translationKey: z.string(),
    title: z.string(),
    description: z.string(),
    label: z.string(),
    heading: z.string(),
    intro: z.string(),
  }),
});

export const collections = { articles, frameworks, notebook, pages };
