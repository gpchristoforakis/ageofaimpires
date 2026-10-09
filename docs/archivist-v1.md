# The Archivist V1: text integration

This document records the text-only checkpoint. The separate voice preview
extends it as described in [Archivist Voice Preview](archivist-voice-preview.md).

The static site loads `assets/archivist.css` and `assets/archivist.js` on all
18 public HTML pages. The launcher opens a native modal dialog: 440px at desktop
widths and a full-screen drawer at widths up to 600px. Conversation state lives
in memory on the current page only. Nothing is written to browser storage by
The Archivist. The existing shared theme preference continues to apply.

## Worker adaptation

The existing `_worker.js` now handles `POST /api/chat` alongside the unchanged
contact, subscription, redirect and static asset handlers. No build step,
React, Express, SDK dependency or additional backend was added.

The reference is donor commit `aab5f99b3dfdfb69a674b996acb331606a481831` in
`gpchristoforakis/ageofaimpires-archivist`. The donor's system instructions are
copied exactly. The model remains `gemini-3.1-flash-lite`, using its default
sampling parameters and the same File Search tool configuration. No temperature,
topP, topK, seed or thinking override is sent. Native `fetch` calls the Gemini
`v1beta` generateContent API. The donor's transient-error policy is retained
(up to three attempts with 2.5s/5s delays), within a 60s request deadline.

The fixed store is:

`fileSearchStores/age-of-aimpires-archive-oygcx3s6yi3t`

The Worker contains a static snapshot of the 11 donor registry records selected
by the donor's existing predicate: nonempty `fileSearchDocName` and
`retrievalEligible === true`. Only the fields used for citation mapping are
copied. Registry order, eligibility values, canonical URLs, headings and
document identifiers are unchanged. A chunk is eligible for a public source card
only when a valid `groundingSupports[].groundingChunkIndices` reference identifies
it as answer support. Absent support, invalid references and unsupported chunks
produce no cards. Supplied document identities must match an allowlisted
`fileSearchDocName` exactly; unknown or conflicting identities are rejected.
Only when identity is absent can a unique exact title be used. Slug, substring,
snippet and heading guesses are not used. Cards retain the donor output fields
and canonical-URL deduplication. No sources are derived from answer text, and
no section anchors are synthesized.

There is no runtime filesystem, store lookup/creation, upload, sync, ingestion
or admin API. The snapshot does not refresh automatically when the publication
or remote archive changes. A later metadata refresh must come from the approved
registry, preserving the strict support/identity checks and eligibility.

Page context is sent as an additional text part marked as untrusted navigation
metadata, without changing the locked system instruction. It supplies the
published page URL, real heading/title, entry number inferred from the route,
current reading heading and HTML language. It is never fetched by the Worker
and never used as citation evidence.

## Cloudflare configuration required before live acceptance

- Set the server-side Cloudflare Pages secret `GEMINI_API_KEY` in the intended
  environment. The key must belong to a Google project with access to the fixed
  File Search store and model. The same variable is required separately in any
  preview environment used for acceptance testing.
- No additional binding, database, build command or environment variable is
  required for chat. Preserve existing contact/subscription configuration.
- Do not put the key in HTML, browser JavaScript, this document, or Git.
- No credentials were added and no live Gemini request or deployment was made
  during local verification.

## Request and UI limits

The API accepts POST with JSON, rejects cross-site browser requests and limits
the streamed body to 64KiB. The question is limited to 4,000 characters. At most
eight history messages are accepted, with 8,000 characters per message and
32,000 characters total. Context fields are individually bounded; the page URL
must be on `https://ageofaimpires.com`. All API errors are safe structured JSON
without stack traces or provider response bodies. Responses are not cached.

The browser preserves the conversation for panel reopenings on the same page,
sends bounded recent history, and resets on navigation. A failed exchange does
not enter model history. Retry resends the failed question without duplicating
its displayed bubble. Sources render as text with canonical publication links
that open a new tab with `noopener noreferrer`.

The launcher and small message avatars use the donor portrait. Only the main
panel avatar has the idle clip. The clip loads lazily, pauses when the panel or
tab is hidden, and is not loaded with reduced motion enabled. Playback failure
leaves the portrait visible; image failure leaves a typography fallback. There
is no voice UI, voice transport or microphone permission request. Existing page
loops (including the contact portrait) pause while the dialog is open and resume
after closing when previously playing and motion is permitted, so two looping
videos do not run together.

## Local checks

Run with an existing Node 24 installation (no package installation):

```text
node scripts/check-site-chrome.cjs
node scripts/test-entry-subscription.cjs
node scripts/test-archivist.cjs
```

`test-archivist.cjs` reads the donor repo beside this checkout, or the directory
specified by `ARCHIVIST_DONOR_PATH`. It compares the locked instructions,
registry and asset bytes, executes the donor's actual text-chat source with
mocked dependencies, and checks supported citation output and rejection cases.
It mocks all provider calls
and verifies request validation, payloads, errors, retries, existing routing
and contact sending. It also verifies that removing the new asset includes
restores each HTML page exactly to the branch's common ancestor with `main`, so
the regression check remains valid after committing. It uses Node's built-in TypeScript
stripping to read the donor source; no donor code is run with real APIs or
filesystem dependencies.

With an existing Playwright installation resolvable via `NODE_PATH` and installed
Microsoft Edge, run:

```text
node scripts/test-archivist-browser.cjs
```

This starts and stops a temporary local HTTP server. It tests all 18 pages in
both themes at 1440px and 390px, plus the 320px panel, modal keyboard behavior,
existing theme/menu controls, context, loading/error/retry states, sources,
page-session history, reduced motion, playback and fallback. Responses are
mocked except the real local Worker's missing-secret response. Screenshots are
written to the OS temporary directory, outside the deployed site.

## Live checks still required

After the secret and a real Cloudflare runtime are available, test:

- `What is the Completion Boundary?`: named concept, grounded in the archive.
- `Explain Effective Task Cost.`: grounded explanation and correct source.
- `What does the publication say about AGI?`: no unsupported archive claims.
- `Hello`: normal conversation without unnecessary archive claims.
- Follow-up context and real File Search grounding/canonical source cards.
- Store permissions, model availability, response latency and real provider
  failure behavior in Cloudflare Pages.

Local mocks demonstrate transport and UI behavior, not answer quality or remote
store accessibility. The route is public; cross-site request checks do not
prevent scripted abuse. After V1, consider Cloudflare abuse protection and
Google API quota/budget controls. No rate-limiting infrastructure was added.

## Verified local results

- Shared site-chrome check: passed on all 18 pages.
- Existing subscription suite: passed with mocked Resend responses.
- Archivist API suite: passed all citation cases A-G, 34 supported deterministic
  fixtures (32 unchanged donor outputs and two corrected Deep Dive/title-order
  cases), and 55 rejected former fuzzy fixtures. Exact instructions, metadata
  and asset bytes match the donor; original page content, contact behavior and
  redirects are preserved.
- Browser suite: passed on all 18 pages at desktop/mobile widths in both themes,
  plus 320px layout, real reading-section context, source cards in both themes,
  keyboard controls, session history, loading/error/retry, video playback,
  contact-loop coordination and media fallback. Screenshots were inspected.
- Current CSS/JS hashes checked on all pages; no Gemini credential or environment
  variable appears in browser HTML/JS/CSS. No credentials were introduced.
- Diff checked with Windows CRLF handling. Original page line endings preserved.
- Donor working tree remained clean. Verification installs nothing and makes no
  live provider requests. Voice debugging was not performed. Merging and
  production deployment remain separate from the preview branch commit/push.

## Exact production file manifest

All paths below are relative to the repository root.

Changed (19 files; page changes are only the two new asset includes):

```text
_worker.js
about.html
age-of-aimpires-entry-01.html
age-of-aimpires-entry-02.html
age-of-aimpires-entry-03.html
connect-the-source-not-your-entire-digital-life.html
contact.html
entries.html
framework-effective-task-cost-operators-deep-dive.html
framework-effective-task-cost.html
frameworks.html
give-the-job-its-own-rules.html
how-to-check-whether-you-have-this-feature.html
how-to.html
index.html
notebook.html
privacy-policy.html
tell-your-ai-how-you-like-to-work.html
terms.html
```

Added (7 files):

```text
assets/archivist.css
assets/archivist.js
assets/archivist/archivist-idle.mp4
assets/archivist/archivist-portrait.jpg
docs/archivist-v1.md
scripts/test-archivist-browser.cjs
scripts/test-archivist.cjs
```
