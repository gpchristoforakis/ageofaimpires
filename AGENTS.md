# Site requirements

- This is a static HTML site. Preserve the existing editorial copy, routes,
  visual system, and hosting files when making scoped changes.
- Every new page, and every replacement or redesigned page, must include the
  shared light/dark theme toggle with the saved preference and all three
  publication social icons. This is a standing user requirement.
- Load `assets/site-theme.js` in the head before page rendering (without `async`
  or `defer`). Load `assets/site-theme.css` after the page's existing styles.
  Adjust relative asset paths for pages in subdirectories.
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
