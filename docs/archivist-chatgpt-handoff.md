# The Archivist ChatGPT Prototype: Handoff

9 October 2026. Local development branch: `codex/archivist-chatgpt`.
Baseline: `a0726fe9c1b73b5667b1d605daf00bfb19c2a313` on main.

## Latest Hosted Test

Later update: a separate public-hosting candidate `aoai-archivist-mcp` is now
deployed with shared durable daily/monthly limits and live queries disabled.
The user reports developer verification is complete. 62 tests and 11/11 hosted
page fetches pass. The Gemini secret is awaiting user entry in Cloudflare.
See `archivist-public-release.md` for the current handoff and remaining public
submission requirements; the existing private ChatGPT tunnel remains in use.

The user completed scoped Cloudflare login and attempted the requested deployment
instruction in Command Prompt. The agent then deployed the authorized test Worker:
https://aoai-archivist-free-test.christoforakis.workers.dev, current version
`1f685f98-b8fc-456f-991e-ec287200360e` at 100% traffic. All 11 live fetches pass.
Gemini generation remains disabled; no secret was added to Cloudflare.

Initial hosted CPU was higher than local screening. The extractor now uses the
same HTML parser with a direct DOM walk instead of Cheerio selectors and list
clones. All 58 tests and exact extracted-output hashes for all 11 pages pass.
Local medians are 2–5 ms. The user authorized the About image fix and left its
implementation to the agent. PR #12 published the identical PNG as an external
asset, reducing live About HTML from 2,930,049 to 36,187 bytes. Merge commit:
`1fa7273df0a392dc48e92347e842a09e877c2cb8`; Cloudflare deployment:
`07a70c4b-2625-4bde-8cd0-437b2a7bb8cf`. Only `about.html` and the PNG were
committed, pushed and published. The user's existing working copy received the
same image-source substitution without replacing its other uncommitted edits.

About CPU measured 8 ms after publication versus 60 ms before, on the same MCP
Worker version. These are individual samples; full hosted CPU coverage remains
unconfirmed. All 11 live fetches still pass. Preview visual checks passed in
both themes at 1440px and 390px, including image loading, mobile menu, sticky
header, saved theme and publication social links. The production image is
byte-identical and visibly loaded. Contact's MP4 and its 64 KB poster are
external assets already, so neither is fetched by the Archivist's HTML reader.

The authenticated Cloudflare Workers plans page confirms Free as the current
plan. No paid upgrade or extra OAuth scope was added. Gemini remains disabled
on the hosted test Worker; the existing private ChatGPT tunnel is still the
live-query prototype. See `artifacts/about-publication-verified.json` and
`cloudflare-about-after-publication.json` for evidence. Earlier development
notes below describe their original checkpoints, not the current release state.

## What Works

- Official MCP SDK Streamable HTTP endpoint with exactly `query_archive` and
  `fetch_entry`, input/output validation, readable sources and safe errors.
- Shared archive configuration/query core used by the existing website Worker
  and the separate MCP endpoint. Website response format remains compatible.
- Strict plugin grounding gate suppresses a complete answer if an
  answer-referenced source is unknown, conflicting or malformed.
- Plugin source catalogue distinguishes Entries from frameworks and guides;
  generated Entry numbers must identify one of the supported Entry sources.
- Exact-ID live publication fetching with bounded redirects, response size,
  execution time, cleaned editorial text and real section anchors.
- Node standalone server and separate Cloudflare Worker entry point.
- Demo and SDK smoke client run without installing npm dependencies once
  packaged. Demo archive queries are explicitly simulated; page fetching is real.

## Verified Evidence

- 55 prototype tests passed, including SDK calls over real local HTTP and
  a query executed by Cloudflare's local runtime with intercepted Gemini.
- Live SDK smoke fetched all 11 approved pages successfully. The saved sample
  includes a fixture answer, canonical citations and actual published text.
- Website text/citation and subscription regressions passed; all 21 voice
  tests passed. Browser checks covered 18 pages, both themes, desktop/mobile,
  voice controls, source cards, focus and cancellation. Site chrome passed.
- Both the separate MCP Worker and modular publication Worker compile and
  run in Cloudflare's local runtime. Publication HTTP smoke confirms the
  homepage and safe missing-secret API responses; new server/prototype source
  paths return 404 rather than being exposed as static assets.
- Runtime dependency audit reported zero vulnerabilities at verification.
- The user's live Gemini smoke test at 13:01 UTC on 9 October returned
  `grounded` and fetched 11/11 published entries. Its saved answer had three
  valid canonical source links and took 16.1 seconds for the archive query.
- That initial live answer incorrectly labelled the Operator's Deep Dive
  framework as Entry #02. The updated adapter adds source-identity guidance
  and rejects Entry numbers absent from supported Entry sources. A regression
  test reproduces this exact failure. The user's live retest at 13:10 UTC
  returned grounded, correctly named Entry #01 and the framework separately,
  retained three valid canonical links, and fetched 11/11 pages. Query time
  was 8.4 seconds. This is one reviewed query, not broad quality acceptance.
- Credential metadata only: `Default Gemini API Key` in `Default Gemini
  Project` accesses the configured archive. `AI AGENT` in `TheStudio CY`
  returned no visible stores. No credential values were read or copied by
  the agent; the user entered the working key in their Command Prompt session.
- The initial shared-core implementation made no HTML/CSS/browser asset edits.
  The later About-only asset change is described below. No commits, pushes or
  production website deployments occurred, and the original dirty checkout was
  preserved. The separately authorized test Worker deployment is recorded above.
- On 9 October, the user created a private Secure MCP Tunnel and a runtime
  key restricted to Tunnels Read + Use. The local client v0.0.16 initialized
  the Archivist MCP session and fetched the tunnel metadata. Local health
  and readiness checks both returned HTTP 200 (`live` and `ready`).
- The user's ChatGPT plugin screen now shows The Archivist as Connected.
  This confirms plugin creation and connection. The plugin ID is
  `plugin_asdk_app_6ac8f0005ab481918f65e6ddc966ac38`.
- The first user-supplied ChatGPT answer was checked against live Entry #01
  and the Effective Task Cost Framework. Its cost breakdown, completion
  boundary, proposed measures and canonical links are supported. The
  twenty-minute example comes from the framework rather than Entry #01.
  See `integrations/archivist-chatgpt/artifacts/chatgpt-first-answer-review.md`.
  ChatGPT's internal tool trace was not supplied; broader acceptance remains.
- A second user-supplied ChatGPT answer quotes the two requested sentences
  from Entry #01 Part 06 exactly, including punctuation, and links the correct
  source. The review artifact records the prompt, response and remaining checks.
- A third user-supplied ChatGPT answer correctly reports no archive support
  for pet axolotl feeding instructions, without general advice or fabricated
  sources. Three visible response scenarios have now passed review.
- A fourth user-supplied answer resolves an earlier-topic follow-up after the
  unrelated axolotl request. It distinguishes free usage from time/attention
  costs, cites the right pages and labels its numerical example illustrative.
  Four visible response scenarios have passed; host tool traces remain unverified.
- Quick additional acceptance: 56 automated checks passed across the regression
  suite and a new HTTP/SDK outage-recovery test. Two live repeated queries were
  grounded; quoted hostile instructions were ignored; fabricated Entry #99
  references failed closed. Provider 403/429/503 fixtures returned safe errors
  without secret leakage. ChatGPT also ignored a quoted override and correctly
  reported the missing Entry. Its pending query args were inspected and contained
  a clean self-contained question. See the review artifact and quick-acceptance.json.

## Free Hosting Screening

The candidate About page now loads its byte-identical PNG from
`media/about-portrait.png`; only the image `src` changed. Its HTML fell from
2,930,269 to 36,407 bytes and local workerd fetch median from 24 to 4 ms.
All 11 candidate fetch medians are 3–7 ms; fixture query median is 1 ms.
Full extracted-output parity passed for all 11 pages. All 58 tests, the
18-page site-chrome check and the test-Worker deployment dry-run passed.

`wrangler.free-test.jsonc` prepares a separate Worker with Gemini disabled
in code. Local SDK verification fetched 11/11 current public pages. Cloudflare
sign-in was subsequently completed and the separate test Worker deployed, as
recorded above. No paid upgrade occurred.
Browser visual QA was blocked by the browser tool's local-URL security policy.
Production CPU accounting and publication of the About update remain pending.
See `archivist-chatgpt-free-hosting.md` and `archivist-chatgpt-deployment.md`.

## Try It

Extract the standalone package and run with Node 24+:

```powershell
node ./archivist-smoke.mjs
```

It starts a temporary endpoint, performs the fixture query and all live page
fetches, saves `artifacts/demo-smoke.json`, and closes the endpoint.

For a persistent local endpoint:

```powershell
node ./archivist-server.mjs --demo
```

The endpoint is `http://127.0.0.1:8787/mcp`. Remove `--demo` and supply the
server-side Gemini secret for live archive queries. The package contains no
real credential. Source files are included as an overlay for the baseline
repository; they are not a complete replacement website.

## Remaining Before ChatGPT Acceptance

1. Keep both the live Archivist server and Secure MCP Tunnel client running.
   The personal ChatGPT plugin is connected through the private tunnel.
2. Broaden representative answer and hostile-source checks. Verify a full tunnel
   disconnect/reconnect and the ChatGPT experience during that outage.
3. Review the final implementation and results before commit/push/publication
   or public directory submission.

The 11-document File Search snapshot remains fixed. Live entry fetching does
not refresh it. Structural grounding checks are not full factual-entailment
verification. Four connected responses have passed a manual review; broader
answer quality and a full real tunnel outage remain unverified. Limited injection,
missing-entry host behavior and isolated provider outage/recovery checks passed.

See `archivist-chatgpt-v1.md` for contracts and the complete acceptance inventory.

## Private ChatGPT Connection

The user created The Archivist as a personal ChatGPT plugin using Tunnel and
No authentication. The tunnel ID is
`tunnel_6ac8ea261470819189191d878ae40284`. The runtime key is held in the user's
Command Prompt environment as `CONTROL_PLANE_API_KEY`; its value is not stored
in this document or the local tunnel profile. The key expires after 30 days.

The standalone package has the official v0.0.16 Windows tunnel client in
`tools/tunnel-client-v0.0.16/` and its non-secret profile in
`tools/tunnel-profiles/archivist-chatgpt.yaml`. From the package folder, run:

```bat
tools\tunnel-client-v0.0.16\tunnel-client.exe run --profile archivist-chatgpt --profile-dir tools\tunnel-profiles
```

Keep this window and the live `node archivist-server.mjs` window open during
ChatGPT testing. The MCP server still binds to loopback at port 8787, and the
tunnel's local status UI is at `http://127.0.0.1:8788/ui`. No public deployment
or directory submission has occurred. The first real ChatGPT answer has been
reviewed against both cited live pages, and the exact quotation check passed.
The unsupported-topic and context-dependent follow-up checks also passed.
This establishes a working private prototype. Additional repeated-query,
quoted-instruction, missing-entry and simulated outage/recovery checks passed.
Remaining acceptance work includes broader repeatability, hostile retrieved
source content and a full real tunnel disconnect/reconnect.

Official connection guide: https://developers.openai.com/plugins/deploy/connect-chatgpt
and https://developers.openai.com/api/docs/guides/secure-mcp-tunnels.
