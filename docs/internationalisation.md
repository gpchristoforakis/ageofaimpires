# English and Greek content

The site renders one shared set of Astro layouts and components at language-prefixed URLs. English is the default editorial language; Greek content is published only when supplied by an editor.

## Add the first Greek article

1. Create `src/content/articles/el/cars-vs-llms.mdx`.
2. Use `language: el`, `translationKey: cars-vs-llms`, and the desired Greek `routeSlug` in frontmatter. Keep the `translationKey` identical to the English entry at `src/content/articles/en/cars-vs-llms.mdx`. `routeSlug` controls the public URL without overriding Astro's language-specific content ID.
3. Add the supplied Greek title, description, kicker, heading, intro, read time, and body copy. Keep the numbered section order. The `article-visuals` remark plugin recognises `translationKey: cars-vs-llms` and inserts the existing responsive hero, vehicle-lineup, and steering-wheel illustrations in the same logical positions, with Greek alt text. No image calls or duplicate image files are needed in the translated copy.
4. Keep translated tables in the copy and pass `language="el"` to `ComparisonTable`. Shared interface labels then come from `src/i18n/ui.ts`. The same `language` prop applies to `BoundaryDiagram` and `TaskCostCalculator` in future translated articles.

The dynamic article route discovers the new entry automatically, emits `/el/articles/{routeSlug}/`, pairs it with English through `translationKey`, enables the language switcher, and adds reciprocal `hreflang` links and the page to the sitemap.

Greek framework, notebook, and page entries belong in the matching `el` folders. Shared interface strings live in `src/i18n/ui.ts`; route and locale rules live in `src/i18n/config.ts`.

Until a translation exists, the unavailable language is disabled in the switcher. Greek home and article-index shells explain that editorial translations have not been supplied; they do not manufacture article copy.
