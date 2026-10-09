# Archivist Free Hosting Assessment

Date: 9 October 2026.

## Hosted Test Update

The separate test Worker is deployed at
https://aoai-archivist-free-test.christoforakis.workers.dev, version
`1f685f98-b8fc-456f-991e-ec287200360e`, receiving 100% of test traffic.
The official SDK check fetched 11/11 current published pages. Gemini generation
is disabled in code. The authorized About update is published through PR #12,
merge `1fa7273df0a392dc48e92347e842a09e877c2cb8`, Cloudflare deployment
`07a70c4b-2625-4bde-8cd0-437b2a7bb8cf`.

Cloudflare measured CPU above the 10 ms target on several requests in the first
revision. The extractor now walks the existing HTML parser's DOM directly,
removing repeated CSS selector and subtree-cloning work. All 58 tests and exact
11-page output parity still pass. Local candidate fetch medians are now 2–5 ms
(About 2 ms). The deployed bundle is 954.16 KiB, 212.21 KiB gzip.

The public About HTML is now 36,187 bytes, down from 2,930,049 bytes. Its
2,170,397-byte PNG is preserved as a separate asset. Contact's 1,357,019-byte
MP4 and 64,629-byte poster are already external; the Archivist does not fetch
them when reading the page HTML.

On the unchanged MCP Worker version, the successful About CPU sample dropped
from 60 ms before publication to 8 ms after publication. This is a single
before/after comparison, not a complete workload or repeatability guarantee.
All 11 published-page fetches still pass. Full per-page CPU coverage remains
incomplete because some invocation events were absent from the tail capture.

The authenticated Cloudflare Workers plans page now confirms Free as the current
plan. The earlier subscription API request returned 403 because of its scoped
OAuth access; no additional access or paid upgrade was needed. Preview visual
checks passed at desktop and mobile widths in both themes, and the public
portrait loads with byte-identical image data. Publication needs no further
approval for this completed two-file change.
Evidence: `artifacts/cloudflare-deployment.json`, `hosted-check-optimized-all.json`,
`cloudflare-live-optimized-partial.json`, `cloudflare-live-execution.json`,
`parser-extraction-parity.json`, `published-media-audit.json`,
`about-publication-verified.json` and `cloudflare-about-after-publication.json`.

## Earlier Local Screening

The prepared candidate now passes the local screening target for all 11 pages.
The About fetch median fell from 24 ms to 4 ms after moving the identical PNG
from inline base64 into `media/about-portrait.png`. Its HTML fell from 2,930,269
bytes to 36,407 bytes (98.8% smaller). Other fetch medians were 3–7 ms; the
simulated archive query median was 1 ms.

This is not a confirmed production free-plan result. The publication change
is local and unpublished, and local elapsed processing is not Cloudflare's
CPU accounting. The current published About page still embeds the image.

## What Was Measured

- Actual Worker dependencies and code ran in local workerd through Miniflare.
- All 11 approved HTML pages from the local candidate were fetched through
  the full MCP path. Only the About image reference differs from the baseline.
- Seven warmed processing samples per operation, after three warm-ups.
- Query calls used an in-memory Gemini fixture: no real key, provider charge,
  or provider/network wait. Page-response fixture encoding is prepared outside
  the timed region; response reading, extraction and MCP serialization are inside.
- Final medians: archive query 1 ms; page fetches 3–7 ms; About fetch 4 ms.
  All seven About samples were 4 ms. The largest page-fetch sample was 10 ms.
  These timings are not a guarantee of production CPU fit or cold-start behavior.
- Wrangler deployment dry-run succeeded: 1,078 KiB uncompressed, 239.50 KiB gzip.
  The currently documented Worker size limit is 64 MiB uncompressed.

## Local Changes And Verification

The adapter now finds the end of inline media attributes with a native substring
search instead of a regex scanning the entire base64 payload. Raw style, script
and noscript elements are also removed before editorial DOM parsing.

- Exact SHA-256 parity of complete extracted results: 11/11 baseline pages.
- 58 automated tests passed, including the large-media regression and a test
  proving the hosting-check Worker cannot call Gemini even if given a key.
- The PNG is byte-for-byte identical to the original embedded image. Reversing
  the single `src` replacement exactly reconstructs the original HTML.
- Site-chrome validation passed on all 18 pages. The new HTML and image returned
  HTTP 200 from the local preview server. Browser visual checking remains pending:
  the browser tool rejected the local URL under its security policy.
- The dedicated test Worker dry-run passed (1,078.54 KiB / 239.61 KiB gzip).
  An official SDK smoke check through local workerd fetched 11/11 real published
  pages with Gemini generation disabled. This was a local server, not a deployment.
- At this earlier local stage no deployment had occurred. The hosted test
  update above records the subsequently authorized test deployment. No website
  publication, commit, push or account upgrade occurred.

## Prepared Next Step

`wrangler.free-test.jsonc` prepares a separate `aoai-archivist-free-test` Worker
with invocation logging and Gemini disabled in code. `scripts/check-hosted.mjs`
checks that endpoint's identity and both tool contracts, then reads all 11 pages.
It refuses a normal live-query endpoint. The existing private ChatGPT tunnel
continues to serve real archive queries.

Wrangler is now authenticated with scoped Worker permissions, and the separate
test Worker is deployed. The deployment plan and remaining checks are in
`archivist-chatgpt-deployment.md`. Publication of the two-file About update still
requires user authorization.
The About optimization only helps live fetching after the website update is live.

The current proof of concept can keep running through the private local tunnel.
Gemini costs and account tier remain separate from Cloudflare hosting costs.

## Evidence

- `integrations/archivist-chatgpt/scripts/profile-free-tier.mjs`
- `integrations/archivist-chatgpt/artifacts/free-tier-profile.json`
- `integrations/archivist-chatgpt/artifacts/free-tier-profile-before.json`
- `integrations/archivist-chatgpt/artifacts/free-tier-profile-inline-portrait.json`
- `integrations/archivist-chatgpt/artifacts/free-tier-extraction-parity.json`
- `integrations/archivist-chatgpt/artifacts/about-extraction-parity.json`
- `integrations/archivist-chatgpt/artifacts/about-portrait-verification.json`
- `integrations/archivist-chatgpt/artifacts/free-test-local-check.json`

Official limits: https://developers.cloudflare.com/workers/platform/limits/
Official local timer behavior: https://developers.cloudflare.com/workers/runtime-apis/performance/
Local limits are not enforced as deployed CPU limits:
https://developers.cloudflare.com/workers/wrangler/configuration/
