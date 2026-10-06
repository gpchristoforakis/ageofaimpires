# Homepage and spacing revision — 6 October 2026

Implemented the nine requested changes locally against the current standalone
HTML site. The references are `landing_page_mockup_v4.html` and
`landing_page_mockup_full.html`, with the user's later wording taking precedence.

## Homepage

- The existing navigation stays visible when scrolling, including the mobile menu.
- Removed the paragraph beginning “By AI assistants, we mean tools such as”.
- “Pragmatics of AI.” is white. “Zero Coding Needed.” uses the existing brand
  orange, `#CD6A15`.
- Replaced the introduction with lightly polished reference wording:
  “Don't just use ChatGPT, Claude and similar AI assistants as glorified search
  engines. Work with them as trusted partners instead.”
- Used the reference's three topics as a row of editorial value cards.
- Adapted the manifesto banner, entries layout, type, covers and final bio to
  the publication's palette and real links.
- The entries introduction is the user's exact replacement paragraph:
  “Answers are easy. What comes next is the interesting part: the hidden work
  left behind, the fate of websites when assistants do the browsing, and where
  the money goes when nobody is watching the ads.”
- Each entry's coloured title box, pitch, read link and intervening space form
  one accessible link to the existing entry. The entry pages' original
  images, audio, text and routes are retained.
- The final bio uses the reference's two paragraphs verbatim. Only THE STUDIO
  is hyperlinked in the body. The separate closing promotional link is omitted.
- Existing sharing controls and their handlers are retained.

Cover-size correction: removed the 16:9 ratio, which made the stacked tablet
covers grow excessively tall. The coloured boxes are now 144px high on desktop
and tablet, and 128px on mobile, with smaller padding and 22–26px titles. The
entire card remains clickable and all existing copy is preserved.

## All-page footer

The footer remains on all 18 pages. It now reads:

> From Ideas To Implementation
>
> Done with theory? Good. Let's stack up some practice. Visit THE STUDIO

“Visit THE STUDIO” is an inline editorial link to
`https://thestudiocy.framer.website/`. The About link stays in place and the
optional SPOT fragment remains available without being inserted into entries.

## Spacing

Reviewed all 18 pages on desktop and mobile. Removed stacked sharing-control
margins and excessive section/page-end padding. Adjustments are scoped by page
type; diagram geometry, content widths, entry wording and navigation are
preserved. The homepage sharing control aligns with the entries column.

The homepage gap from the first sharing button to “Entries” is now 53px at all
five checked widths; the previous desktop gap was approximately 149px. The
desktop/mobile content-gap audit found no remaining empty gaps over 120px.
SVGs, images, form controls and all visible text were included in that audit,
so actual diagram and media content was not mistaken for blank space.

## Files changed in this revision

All 18 root pages gained a page-type class and the shared spacing stylesheet,
and received the amended footer copy:

- `about.html`
- `age-of-aimpires-entry-01.html`
- `age-of-aimpires-entry-02.html`
- `age-of-aimpires-entry-03.html`
- `entries.html`
- `connect-the-source-not-your-entire-digital-life.html`
- `contact.html`
- `framework-effective-task-cost-operators-deep-dive.html`
- `framework-effective-task-cost.html`
- `frameworks.html`
- `give-the-job-its-own-rules.html`
- `how-to-check-whether-you-have-this-feature.html`
- `how-to.html`
- `index.html` (also received the homepage layout and copy)
- `notebook.html`
- `privacy-policy.html`
- `tell-your-ai-how-you-like-to-work.html`
- `terms.html`

Other changed files:

- `assets/homepage.css` (new): homepage layout, sticky header and responsive styling.
- `assets/editorial-spacing.css` (new): site-wide, scoped spacing adjustments.
- `assets/editorial-studio.css`: plain inline footer-link styling.
- `docs/studio-connection.md`: current footer and author-note documentation.
- `docs/homepage-revision-2026-10-06.md` (new): this change record.

The complete release ZIP contains all 40 site and supporting files. It excludes
`.git` and ZIP backups. No commit, push or deployment is part of this revision.

## Validation

- All 18 pages passed at 1440, 1024, 768, 390 and 320px (90 route/width checks).
- Checked sticky-header behaviour, mobile menu opening/closing, all nine entry
  click targets (three covers, three pitches, three read links), visible keyboard
  focus and enlarged text.
- Checked exact entries and bio copy, headline colours, footer wording and link
  destinations. No browser script errors or broken images were found.
- Verified that all 18 navigation headers and script bodies are unchanged, and
  every non-homepage content body is unchanged.
- The 16 original supporting files and the optional entry fragment are retained.
- All 40 ZIP members match the current reviewed files exactly; Git data and
  archive backups are excluded.
