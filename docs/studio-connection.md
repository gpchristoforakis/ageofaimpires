# THE STUDIO editorial connection

The current publication is a standalone HTML site. These changes apply to this
site, not the older Astro source project.

Age of AI Empires remains an independent publication. THE STUDIO is referenced
as George's commercial practice in the About bio, homepage author note and shared
footer. Navigation, wordmarks, entry copy, page titles and metadata are preserved.

## Selective entry note

`components/studio-context-note.html` is a reusable HTML fragment. Copy its aside
after a paragraph only where an entry discusses finding practical business
applications for AI. Do not insert it into every entry or use it as an entry
sign-off by default. No published entry currently contains this note.

The root pages already load `assets/editorial-studio.css`. Its note treatment
uses the existing entry marginalia language: small sans-serif text, a fine
vertical rule, teal links and the publication's CSS variables. It stays in the
reading flow on all screen sizes and adds no JavaScript or button.

## Footer and destinations

All 18 existing root HTML pages contain the same small footer reference,
placed after their existing publication and legal links. It uses each page's
existing `shell` or `wrap` container. About adds one paragraph in “The Short
Version”, immediately after the existing entrepreneur/branding introduction.

- About, homepage author note and footer: `https://thestudiocy.framer.website/`
- SPOT: `https://thestudiocy.framer.website/#spot-start`, matching the site's
  own SPOT navigation and existing section ID, inspected on 6 October 2026.

The footer is static HTML, consistent with the site's current structure.
If its wording or destination changes, update all 18 root page footers.
The About link and optional note fragment hold their destinations directly.

## Exact changed files

All of these root pages gained the footer reference and stylesheet link:

- `about.html` (also gained the bio paragraph)
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
- `index.html`
- `notebook.html`
- `privacy-policy.html`
- `tell-your-ai-how-you-like-to-work.html`
- `terms.html`

New files:

- `assets/editorial-studio.css`: scoped styles using the publication's variables.
- `components/studio-context-note.html`: optional SPOT callout fragment.
- `docs/studio-connection.md`: this integration and usage guide.

No existing entry body was changed. About adds:

> I write Age of AI Empires and run THE STUDIO, where I help businesses find practical ways to use AI.

The current footer reads:

> From Ideas To Implementation
>
> Done with theory? Good. Let's stack up some practice. Visit THE STUDIO

The homepage also uses the supplied full mockup's two bio paragraphs, with THE
STUDIO linked in the body and no closing promotional link. See
`docs/homepage-revision-2026-10-06.md` for the subsequent nine-change revision.

The entry fragment adds:

> Trying to work out where AI actually makes sense in your business? That’s what SPOT is designed for.
