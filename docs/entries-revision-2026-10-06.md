# Entries revision — 6 October 2026

Local changes against the current standalone HTML website. Reference:
`entries_page_mockup_v4.html`; the user's later control-order amendment takes
precedence over the mockup's layout. No commit, push or deployment was made.

## What changed

- The directory is now `entries.html`, with a canonical URL of
  `https://ageofaimpires.com/entries`. All internal links, navigation, titles,
  descriptions, eyebrows and accessibility labels use Entry or Entries.
- Custom code names also use entry/entries. Native sections replace the old
  content elements, and Open Graph types use the supported `website` value.
  Only the hosting worker retains legacy directory paths, to redirect existing
  bookmarks permanently to `/entries`, preserving query parameters.
- Applied the reference's directory headline, standfirst, three entry titles
  and three descriptions. The existing detailed entries retain their titles
  and content, with terminology and British spelling corrections.
- Removed numbered top kickers from the directory and all three entry headers.
- Each directory entry has a compact frame. Its real reading link stretches
  over the frame, so the heading, description and surrounding space open the
  correct entry. Audio controls remain independently operable.
- Every frame ends with one aligned row: **Read This Entry → reading time →
  audio overview**. The read link fills its column; the time and audio columns
  have identical widths across all three frames. All controls share a 48px row
  at ordinary text size, including the pending audio control.
- Reading times are 10, 10 and 8 minutes, matching the existing entries.
- The first two controls use the supplied recordings. Starting one pauses the
  other. Play/pause labels and state are accessible; playback failures are
  announced. Recordings are loaded only on demand.
- The third overview is visibly marked “Coming soon” and disabled. It has no
  invented audio URL and makes no request for a missing recording.
- Reviewed visible copy, transcript text, metadata and accessibility wording
  for British spelling. Corrected forms such as behaviour, labour, judgement,
  summarising, optimising, authorisation and localised. All 18 pages declare
  `en-GB`. Existing audio and raster images are unchanged.

The homepage's approved compact title covers, sticky header, THE STUDIO bio
links, footer wording and optional SPOT note remain in place. No new navigation
item, commercial branding or automatic contextual CTA was introduced.

## Exact file changes

Renamed and rebuilt the directory as `entries.html`. The other 17 root pages
were updated for terminology, navigation, language and applicable spelling:

- `about.html`
- `age-of-aimpires-entry-01.html`
- `age-of-aimpires-entry-02.html`
- `age-of-aimpires-entry-03.html`
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

- `assets/entries.css`: compact frames and aligned responsive control rows.
- `assets/entry-overviews.js`: independent audio playback and accessible states.
- `docs/entries-revision-2026-10-06.md`: this change record.

Other modified files:

- `assets/editorial-spacing.css`: updated entry selector names.
- `assets/editorial-studio.css`: updated entry terminology in comments.
- `components/studio-context-note.html`: updated entry terminology in comments.
- `sitemap.xml`: directory URL now `/entries`.
- `_worker.js`: legacy directory redirects; contact handling is preserved.
- `docs/studio-connection.md`: current file names and entry terminology.
- `docs/homepage-revision-2026-10-06.md`: current file names and terminology.

## THE STUDIO links

No THE STUDIO link was added, removed or redirected in this revision:

- About bio: `https://thestudiocy.framer.website/`.
- Homepage author bio: the same homepage destination.
- All 18 root-page footers: the same homepage destination.
- Optional, unpublished SPOT fragment:
  `https://thestudiocy.framer.website/#spot-start`.

## Validation and package

- Checked all 18 pages at 1440, 1024, 768, 390 and 320px: 90 responsive checks.
- Reviewed desktop and mobile screenshots of the directory.
- Verified control order, alignment, text fit, keyboard order and disabled state.
- Tested all nine heading, description and reading-link click areas.
- Tested actual playback and pausing of both supplied audio files, including
  pausing the previous player when another starts.
- Verified all local links/assets and the new canonical and sitemap URL.
- Tested legacy redirects in the local preview and the hosting worker.
- Confirmed that the worker's contact-handling code is unchanged.
- Checked enlarged text, the lazy-loaded About portrait, and the copy audit.

The new complete root-folder package contains 43 files, excluding Git history,
backup archives and temporary test files. It includes the existing images,
audio, hosting files, optional component and documentation. Previous ZIPs are
retained separately and have not been overwritten.

## Title, indexing and Contact follow-up

The user confirmed the directory titles as authoritative and approved
“Connect With Me” as the Contact page H1. These subsequent changes replace the
earlier decision to retain the original detailed entry titles:

- Entry 2: **Assistants Browse. Websites Wait.**
- Entry 3: **Attention Fades. Money Moves.**
- Updated homepage titles and reading-link accessibility labels, detailed H1s,
  page titles, Open Graph titles and hero image descriptions to match.
- Updated the matching Framework 06 heading that referenced Entry 3.
- Replaced the title lettering in the two existing hero images, retaining
  their illustrations and their exact 1672 × 941 dimensions. No image section
  was added. The two PNG files are now different from the previous package and
  must be replaced when applying this update.
- Both detailed pages now specify `index, follow`, removing the previous
  search-indexing restrictions. Indexing and ranking remain search-engine
  decisions; the local change takes effect publicly only after deployment.
- Promoted the existing “Connect With Me” heading from H2 to H1. Scoped styles
  preserve its exact typography, dimensions and position at all five checked
  widths. The form markup and scripts are unchanged.
- Audio, video, poster, favicon and all other image files remain unchanged.

Exact files modified in this follow-up:

- `index.html`
- `frameworks.html`
- `age-of-aimpires-entry-02.html`
- `age-of-aimpires-entry-03.html`
- `contact.html`
- `assets/entry-02-hero.png`
- `assets/entry-03-hero.png`
- `docs/entries-revision-2026-10-06.md`

Validation: 25 responsive checks of the homepage, directory, framework list
and both detailed entries; five before/after Contact comparisons confirmed
unchanged appearance and form layout. Both updated images have the original
dimensions. All current root pages have one H1. Archive integrity, internal
references, metadata and byte-for-byte package matching were rechecked.

The final complete root package is
`ageofaimpires-2026-10-06-final-root.zip`, containing 43 files and excluding Git
history and backup archives. Extract its contents directly into the website
root, replacing matching files and merging folders. The previous audio/video
files can stay, but the two updated hero PNGs must be replaced. No commit, push
or deployment was performed.
