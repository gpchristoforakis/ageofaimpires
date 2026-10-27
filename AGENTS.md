# Site requirements

- This is a static HTML site. Preserve the existing editorial copy, routes,
  visual system, and hosting files when making scoped changes.
- Every new page, and every replacement or redesigned page, must include the
  shared light/dark theme toggle with the saved preference and all three
  publication social icons. This is a standing user requirement.
- Load `assets/site-theme.js` in the head before page rendering (without `async`
  or `defer`). Load `assets/site-theme.css` after the page's existing styles.
  Adjust relative asset paths for pages in subdirectories.
- When updating shared CSS, refresh its content-hash `?v=` version in every
  page that loads it. Reuse the current versioned references on new pages.
- Scope mobile menu rules to the primary header navigation. Generic `nav a`
  rules must not hide the footer's social profiles.
- Keep the shared primary header sticky on every page in both themes and at
  mobile and desktop sizes. Preserve working mobile menu and theme controls.
- Reuse the header's `.aoai-header-actions` and accessible
  `[data-theme-toggle]` button from an existing page. Keep the control visible
  on mobile. Do not replace or remove the existing navigation behavior.
- Reuse the footer's `.aoai-social-links`, SVG icons, accessible labels, and
  safe external-link attributes. Use exactly these publication profiles:
  - Instagram: https://www.instagram.com/ageofaimpires/
  - LinkedIn: https://www.linkedin.com/company/age-of-aimpires/
  - X: https://x.com/ageofaimpires
- Verify new content, diagrams, forms, links, and navigation in both themes,
  at mobile and desktop widths. Keep approved light-mode styling intact.
- Run `node scripts/check-site-chrome.cjs` before delivering or publishing
  page changes. This check is required alongside any relevant functional and
  visual checks.
- Commit, push, and publish only when the user authorizes those actions.

# Editorial rules

- Publication identity is `AGE OF AIMPIRES` (never `Age of AI Empires` or
  `Age of Empires`); use the exact spelling in all visible text, `<title>`
  strings, Open Graph/Twitter metadata, and future published copy. The `AI`
  letters may have an accent colour in visible wordmarks, with readable contrast
  in both light and dark themes. Do not apply wordmark markup inside metadata.

- Capitalise the first letter of every word in public titles, headings and
  display labels, including articles and prepositions. Apply this to card
  titles and table captions too. Preserve acronyms and use sentence case for
  body copy, descriptions, quotations and complete quiz questions.
- In fictional examples, prefer widely recognised names such as Mary, Tom,
  Peter and Gloria. Use names with a clear conventional male or female
  association; avoid unisex or gender-ambiguous names such as Taylor.
- Keep each fictional character's name consistent across source material,
  prompts, examples, tests and expected results.
- Editorial notes, warnings and callouts must differ from surrounding body
  copy through both text colour and typography. A left-hand rule alone is
  insufficient. Use the existing ink colour and sans-serif type at a medium
  or semibold weight, with readable contrast in both themes and at all widths.
  Preserve structured content such as formulas and existing text emphasis.
