import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import cloudflare from '@astrojs/cloudflare';
import tina from '@tinacms/astro/integration';
import articleVisuals from './src/remark/article-visuals.mjs';

export default defineConfig({
  site: 'https://ageofaimpires.com',
  output: 'static',
  outDir: './dist',
  adapter: cloudflare(),
  markdown: { processor: unified({ remarkPlugins: [articleVisuals] }) },
  integrations: [
    mdx(),
    sitemap({ filter: (page) => page !== 'https://ageofaimpires.com/' && !page.endsWith('/404.html') }),
    tina(),
  ],
});
