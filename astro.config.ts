import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ageofaimpires.com',
  output: 'static',
  outDir: './dist',
  integrations: [mdx(), sitemap()],
});
