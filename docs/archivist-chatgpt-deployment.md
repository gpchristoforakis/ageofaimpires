# Archivist Cloudflare Deployment Status

9 October 2026. Test Worker deployed; authorized two-file About update published.

## Current Deployment

- URL: https://aoai-archivist-free-test.christoforakis.workers.dev
- Version: `1f685f98-b8fc-456f-991e-ec287200360e`, 100% traffic.
- Live SDK verification: 11/11 published pages pass; Gemini queries remain disabled.
- HTML extraction now uses a direct DOM walk; 58 tests and exact 11-page text
  parity pass. Local candidate page-fetch medians are 2–5 ms.
- Actual optimized-version CPU samples: Entry #01 10 ms; published About 8 ms
  after its image update, compared with the earlier 60 ms sample.
  CPU capture is incomplete and free-plan compatibility is not yet confirmed.
- The scoped login succeeded. The authenticated dashboard confirms Workers Free
  as the current plan. No account upgrade was made.
- The two-file About update was authorized, merged in PR #12 and published at
  commit `1fa7273df0a392dc48e92347e842a09e877c2cb8`, Cloudflare deployment
  `07a70c4b-2625-4bde-8cd0-437b2a7bb8cf`. Preview visual checks passed in both
  themes at 1440px and 390px, and the public portrait's bytes match the original.

## Exact Scope

- Website update: `about.html` plus `media/about-portrait.png`. The existing
  PNG bytes, dimensions, lazy loading, text, styling and routes are preserved.
  The HTML shrinks from 2.93 MB to 36.4 KB. This is an update-only overlay,
  not a replacement for the full publication folder.
- Hosting check: a separate Worker named `aoai-archivist-free-test`, using
  `wrangler.free-test.jsonc`. It has no production website routes, storage,
  Gemini calls or secrets. It reads only the 11 public archive pages.
- The existing private ChatGPT plugin and local tunnel remain the live-query
  prototype. The test Worker is not a replacement ChatGPT connection.

## Verification Before Initial Test Deployment

- 58 automated tests pass, including a real local Cloudflare runtime test
  proving that the test Worker ignores an accidentally supplied Gemini key.
- Local SDK check discovers both tools and fetches all 11 published pages.
- Exact extracted-result hashes match for all 11 candidate pages.
- Exact portrait bytes match; only its HTML `src` value changes.
- Shared site-chrome check passes on all 18 pages.
- Test Worker deployment dry-run passes; no remote upload was made.
- Local profile: 3–7 ms page-fetch medians, About 4 ms, fixture query 1 ms.
  These are screening timings, not deployed CPU measurements.
- At that earlier stage local visual checking was blocked by browser URL policy.
  The authorized Cloudflare release preview subsequently passed visual review.
  Preview with `node scripts/preview-about.mjs` from the integration folder;
  open `http://127.0.0.1:8797/about.html?theme=light` or `?theme=dark` in a
  normal browser. Add `&variant=before` for the original inline-image page.

## Sign-In Reference

The user has now completed this scoped sign-in. These commands are retained
only as a future reference; another login is not currently needed:

```bat
cd /d "C:\Users\plasm\.codex\worktrees\archivist-chatgpt\ageofaimpires\integrations\archivist-chatgpt"
node node_modules\wrangler\bin\wrangler.js login --scopes account:read user:read workers_scripts:write workers_tail:read
```

Complete the Cloudflare browser sign-in and review the requested permissions.
This grants Wrangler account/user read access, Worker-script management and
Worker-log read access. It does not request DNS, Pages or storage write scopes.
Do not paste tokens or account credentials into chat. Signing in does not deploy.

## Website Release Reference And Remaining Hosted Checks

The About release steps below are complete. Remaining work is representative
hosted CPU coverage and controlled activation of live hosted queries.

1. Confirm the intended Cloudflare account, Workers plan and existing Worker
   names. Select the intended account explicitly if more than one is available.
   Do not upgrade the plan or overwrite an existing service with the same name.
2. Review and publish only the About update through the existing publication
   workflow after checking the latest live source. The development worktree also
   contains other changes, so never deploy its entire root as this two-file update.
3. Check the public About HTML is small and the new image URL returns the original
   PNG. Check the actual page in both themes at mobile and desktop widths.
4. The separate test Worker is already deployed. For an authorized future update:

```bat
node node_modules\wrangler\bin\wrangler.js deploy --config wrangler.free-test.jsonc
```

5. Use the returned workers.dev URL, then inspect Cloudflare invocation logs for
   that UTC test interval. The script records elapsed client time separately.

```bat
node scripts\check-hosted.mjs https://YOUR-TEST-WORKER.workers.dev
```

6. Verify successful outcomes and deployed CPU times, including repeat and cold
   invocations. Free hosting is confirmed only for the actual tested workload.

## Enabling Live Hosted Queries Later

The hosting-check Worker intentionally cannot query Gemini. A live hosted service
uses `wrangler.jsonc` and a server-side Gemini secret entered by the user. Verify
the Gemini project's actual billing tier and quota before enabling it. Configure
an enforceable shared usage budget or authentication for the intended audience;
the existing per-isolate limiter is not a daily provider spending cap.

For private accounts or write actions, ChatGPT requires an appropriate OAuth
authorization flow. Anonymous access can suit public read-only material, but
does not by itself control provider usage costs.

Official references:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/wrangler/commands/
- https://developers.openai.com/plugins/build/auth

Publication gate: the repository's `AGENTS.md` states, "Commit, push, and
publish only when the user authorizes those actions."
