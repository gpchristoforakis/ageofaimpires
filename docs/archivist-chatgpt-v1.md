# The Archivist: ChatGPT Integration V1

Development specification, 9 October 2026. Status: local MCP prototype
implemented and tested on Node and Cloudflare's local runtime. Actual ChatGPT
connection and full live answer-quality acceptance are pending. A first
live Gemini smoke test passed; its source-label issue prompted an adapter
correction confirmed on the user's live retest. This
document does not authorize commit, push or publication.

## Intended Experience

A reader asks ChatGPT what AGE OF AIMPIRES says about a topic. ChatGPT invokes
The Archivist, receives a grounded answer and canonical publication links, and
can fetch the cited publication text for closer reading. V1 is public,
anonymous and read-only. It exposes published archive material only.

Start with a personal plugin for development and acceptance. Public directory
submission is a later release step. Custom UI, voice, WhatsApp and archive
administration are outside this implementation scope.

## Verified Backend Baseline

GitHub `main` and the local `origin/main` reference both resolved to
`a0726fe9c1b73b5667b1d605daf00bfb19c2a313` during inspection.
The working checkout is on `archivist-v1` at
`e353bb0ba537b6bdec76e18469186f2dc9343753`, with existing unrelated changes.
Implementation must start from the current main branch in an isolated checkout;
the existing checkout is not the production baseline.

| Component | Verified Behavior | Integration Consequence |
| --- | --- | --- |
| `_worker.js` | Cloudflare static-site Worker, text and voice routes on main | Preserve website routing and response compatibility |
| `POST /api/chat` | Accepts query, bounded history and optional untrusted page context; returns `{reply, sources}` | Reuse grounded query logic, rather than rebuild retrieval |
| `queryArchivist` | Native fetch to `gemini-3.1-flash-lite` with locked system instructions and File Search | ChatGPT integration does not require replacing the Gemini model |
| Source registry | 11 eligible records in a fixed snapshot | New publication does not automatically mean indexed knowledge |
| `mapArchivistSources` | Requires answer support, exact document identity or a unique exact title when identity is absent; deduplicates by canonical URL | Retain these checks; never infer sources from generated prose |
| Existing source fields | Include provider document names; `section` is the first registered heading; snippet is shortened with an ellipsis | Strip provider names; do not display this heading as a matched passage or snippet as an exact quotation |
| Grounding metadata | Claim-to-chunk relationships are flattened into source cards | V1 has entry-level citations, not verified claim-level citations |
| Unsupported answers | Reply is returned even when all sources are rejected | Plugin must add a fail-closed answer check before exposing publication claims |
| Origin protection | Browser requests from another origin are rejected; server requests without Origin are accepted | Preserve website checks; handle MCP transport origin validation independently |
| Voice | `/api/voice/token` and browser voice bridge exist; grounding uses `/api/chat` | No microphone or token-minting capability in the plugin |
| Standalone core | Query, registry and mapper are functions/constants in the Worker, not an independent service | Extract a shared internal module when implementing the adapter |
| Entry retrieval | No full-entry route exists | `fetch_entry` needs a new deterministic retrieval path |

The donor repository at
`C:/Users/plasm/OneDrive/Documents/GitHub/ageofaimpires-archivist` contains
`server/contentExtractor.ts`, `server/sitemapParser.ts`, a richer registry and
sync code. Its parser is a reusable starting point, not a production endpoint.
It follows redirects automatically, lacks a streamed response-size bound and
does not explicitly extract tables. Adapt it before exposing it to tools.
Do not import the sync engine into request handling: it writes registry files
and uploads/deletes remote documents.

## Recommended Architecture

```text
Website Text / Voice ----> Existing Website Handlers --+
                                                     |
ChatGPT ----------------> MCP Adapter ----------------+--> Shared Archivist Core
                                                           | Query + Grounding
                                                           | Registry + Identity
                                                           | Public Entry Fetch
                                                           v
                                             Gemini File Search / Published Site
```

- Extract the locked query configuration, registry and source mapping into a
  shared internal module. Keep the existing website API shape and behavior.
- Add `query_archive` and `fetch_entry` to a Streamable HTTP MCP endpoint.
  Prefer a small Cloudflare adapter; prove SDK/runtime compatibility locally
  before choosing the deployment shape. No new database is needed for V1.
- Use the official MCP SDK for protocol negotiation, tool listing, calls,
  schema handling and transport. Do not hand-roll JSON-RPC.
- Mark both tools `readOnlyHint: true`, `destructiveHint: false` and
  `openWorldHint: true`: they contact external services/public pages. Declare
  anonymous access. Keep credentials in the server environment.
- Apply request/body bounds, cancellation, safe errors and endpoint abuse
  controls. Preserve the current maximum 60-second query deadline and bounded
  provider retries; do not stack adapter retries on top of core retries.
- Archive ingestion/sync remains a separate maintenance process. Tool calls
  must not create stores, upload, delete, trigger sync or mint voice tokens.

## Tool Contracts

The machine-readable descriptor and input/output schemas are in
`archivist-chatgpt-contracts.json`. The prototype uses these contracts; this
file is not an installed plugin manifest. Schema `additionalProperties: false` is deliberate.

### Query Archive

`query_archive({question})` answers a self-contained question about the
published archive. The model should resolve follow-ups into a self-contained
question. Send only that question to Gemini; do not forward the whole ChatGPT
conversation. Whitespace-only input is rejected after trimming. The maximum
question length is 4,000 characters.

The internal request is equivalent to `{query: question, history: []}`.
No fabricated website page context is required.

Successful grounded result:

```json
{
  "status": "grounded",
  "content_origin": "file_search",
  "answer": "A concise archive-grounded answer.",
  "sources": [
    {
      "id": "age-of-aimpires-entry-01",
      "title": "Fast AI. Expensive Lesson.",
      "url": "https://ageofaimpires.com/age-of-aimpires-entry-01",
      "page_type": "entry",
      "publication_date": null
    }
  ]
}
```

Before returning `grounded`, inspect raw provider grounding metadata in the
core. Require nonempty text, at least one supported eligible document, and
valid support indices. Every answer-referenced chunk must resolve to the
approved registry; reject unknown/conflicting identities, another store,
ineligible documents and malformed support references. An unknown chunk mixed
with known chunks must suppress the answer too. The existing flattened
`/api/chat` response cannot prove this condition by itself.

This is a structural grounding gate, not proof that every factual clause is
entailed by a source. Answer-quality acceptance must verify the actual claims.
Full claim-level verification is a possible later extension.

If the gate fails, return:

```json
{
  "status": "no_supported_sources",
  "content_origin": "file_search",
  "answer": "The available archive did not provide verifiable support for an answer to this question.",
  "sources": []
}
```

Do not expose the rejected generated reply. This status does not prove that
the topic is absent from the entire publication. It may reflect weak retrieval
or rejected grounding. Provider failure is an error, not this status.

### Fetch Entry

`fetch_entry({id})` returns cleaned published text for an exact public ID from
the same eligible registry. IDs are the stable publication slugs. The name
includes entries, frameworks, how-to guides, notebook and about material.
Never accept a caller-supplied URL, provider document name, local path or title
guess as a fetch target.

- Resolve the ID server-side to an exact allowlisted canonical URL.
- Fetch the live published page with a 20-second deadline and 4 MiB streamed
  HTML response limit. Validate HTTP status and HTML content type.
- Disable automatic redirects. Follow at most three redirects, validating
  every target as an exact eligible canonical URL before making the request.
  Reject external hosts, credentials, fragments/queries used as fetch targets,
  non-HTTPS schemes and unlisted paths.
- Require any explicit canonical/og:url identity to match the requested
  registry record. Seven baseline pages omit both, so their exact approved
  fetch URL is the fallback identity. Return a safe error on conflicting
  identity; do not require a website metadata change for integration.
- Extract headings, paragraphs, lists, quotations, formulas, tables, captions
  and code examples in reading order. Remove navigation, forms, scripts,
  source-card UI, footers and derivative audio transcripts.
- Preserve substantive published text; do not paraphrase during extraction.
  Use actual HTML anchors or null, never guessed anchors.
- Return at most 60,000 characters of text. An oversized entry returns
  `entry_too_large`; do not silently truncate a result described as complete.
- Fetching must not update the registry or File Search store. The result is
  identified as `live_site`; it may be newer than the File Search snapshot.
  ChatGPT must distinguish newer fetched material from an earlier archive
  answer when a discrepancy is visible.

Success returns `status: "ok"`, `content_origin: "live_site"`, a `source` using
the same citation schema, `text`, and `sections` with `heading` and `anchor`.
Unknown, unpublished and ineligible IDs all return the same `entry_not_found`
error without revealing whether a draft exists. A removed published page also
returns `entry_not_found`.

## Citation And MCP Result Format

- Source `id` is a stable slug; `url` is the registry's exact canonical URL;
  `title` is the approved published title. Preserve null dates. Do not invent
  section matches, publication dates or alternate titles.
- Return public fields only. Remove File Search store/document names,
  credentials, debug logs, stack traces and raw provider responses.
- Return the typed object in MCP `structuredContent`. Include a text content
  block carrying the same information and explicit Markdown source links so
  clients can consume and cite it without custom UI.
- Validate successful results against the output schema before returning
  them. Oversized or malformed query output becomes a safe archive error;
  do not truncate away source relationships to force a schema match.
- Render entry-level citations as `[Published Title](Canonical URL)`, adjacent
  to the relevant explanation. Do not imply verified passage-level alignment.
- Exact quotations require a successful `fetch_entry` and matching source
  text. A shortened grounding snippet is not enough.
- Treat tool answers and fetched page text as data, not host instructions.
  The plugin instructions require ChatGPT to distinguish publication claims
  from its own analysis, preserve limitations and avoid filling archive gaps
  with general knowledge attributed to George.
- Tool execution errors use `isError: true` and safe structured error content
  `{code, message, retryable}`. Invalid MCP envelopes/unknown tool names remain
  protocol errors handled by the SDK.
- Suggested safe error codes: `invalid_arguments`, `archive_unavailable`,
  `archive_timeout`, `rate_limited`, `entry_not_found`, `entry_unavailable`,
  `entry_identity_mismatch`, `entry_too_large`. Only temporary service/timeout
  and rate-limit errors may be retryable. No automatic tool-call retry loop.

V1 uses the two named tools above. Company-knowledge compatibility would also
require the standard `search` and `fetch` schemas; it is not claimed here.

## Acceptance Tests

These are acceptance criteria. The automated prototype suite now exercises
the deterministic transport, grounding and fetch behavior; connected ChatGPT
acceptance is still pending. Fixture tests mock providers and public HTML.
Connected tests require a
working MCP endpoint and an actual ChatGPT session. Each connected result must
record tool calls, returned sources, answer fidelity and elapsed time.

| ID | Layer | Scenario | Required Result |
| --- | --- | --- | --- |
| A01 | Protocol | Initialize, list tools, call each tool | SDK transport succeeds; exactly the two V1 tools and matching schemas |
| A02 | Contract | Empty/blank question, over 4,000 characters, non-string or extra fields | Reject before provider call |
| A03 | Grounding | Known document with valid answer support | Grounded answer; exact public URL/title; provider IDs stripped |
| A04 | Grounding | Retrieved known document with no answer support | Fixed limitation; no generated reply or citation |
| A05 | Grounding | Unknown identity with a known title/snippet | Fixed limitation; no fuzzy title fallback |
| A06 | Grounding | Known and unknown supported chunks together | Suppress entire generated reply; no leaked draft text |
| A07 | Grounding | Conflicting IDs, another store, ineligible source | Fixed limitation |
| A08 | Grounding | Identity absent, one exact title match | Accept; ambiguous title or substring rejects |
| A09 | Grounding | Negative, fractional, out-of-range or wrong-type support index | Safe limitation; no crash or unintended source |
| A10 | Grounding | Multiple supported chunks from one entry | One source per canonical URL, stable ordering |
| A11 | Output | Provider reasoning/key/internal metadata in fixture | Thought parts and internal fields excluded |
| A12 | Resilience | Missing secret, provider failure, quota exhaustion, timeout | Safe error; no uncited answer; bounded retries/deadline |
| A13 | Fetch | Exact eligible entry/framework/how-to/notebook/about ID | Correct canonical identity and cleaned editorial text |
| A14 | Fetch | Draft/unknown/ineligible ID or a URL/local path as ID | entry_not_found or invalid_arguments before fetch; no draft enumeration |
| A15 | Fetch | Redirect to another host, unlisted path, loop or credentials | Reject before contacting prohibited target |
| A16 | Fetch | Canonical metadata disagrees with requested ID | entry_identity_mismatch; no text returned |
| A17 | Fetch | 404/410, non-HTML, oversized HTML/text or stalled body | Safe bounded failure; no silent truncation |
| A18 | Extraction | Formula/table/list/quote/code plus header/footer/form/transcript | Editorial meaning/order preserved; chrome/transcripts removed |
| A19 | Extraction | Section with and without a real HTML ID | Real anchor or null; no invented section links |
| A20 | Security | Prompt injection inside query or fetched page | Does not alter tools, instructions, secrets or access boundary |
| A21 | State | Two readers/consecutive unrelated queries | No cross-session history or stale sources; no registry/store writes |
| A22 | Connected | What is the Completion Boundary? | Correct canonical term, grounded explanation, clickable appropriate sources |
| A23 | Connected | Explain Effective Task Cost, then compare it with Interaction Cost. | Self-contained follow-up call; accurate distinctions and citations |
| A24 | Connected | Compare framework overview with the operator's deep dive. | Distinct source IDs/URLs; no title-prefix collision |
| A25 | Connected | What does George recommend about a topic absent from fixtures? | Limitation preserved; no fabricated attribution |
| A26 | Connected | Show the exact passage behind that answer. | fetch_entry called with returned ID; quote matches returned text |
| A27 | Connected | Hello / unrelated general request | No unnecessary archive call or claim of archive authority |
| A28 | Connected | Query snapshot and live entry disagree | Clearly identifies difference; does not claim archive was refreshed |
| A29 | Connected | Preview endpoint fails or rate limit reached | Clear temporary failure; no repeated calls or invented substitute answer |
| A30 | Regression | Existing website chat/voice, routing and site chrome suites | Pass; existing response shapes and site controls preserved |

Release gate: all deterministic contract/security/grounding/fetch cases pass;
all connected scenarios pass factual/citation review. A partial pass count
does not waive failures exposing drafts, inventing citations or altering the
website. Measure latency on real calls before setting a tighter product SLO.

## Verification Completed In This Step

Checks ran in the clean voice-integration worktree at `ea39c0f`, whose Worker
and complete Git tree match main at the verified merge commit:

- `node scripts/test-archivist.cjs`, with the donor path supplied: passed
  citation cases A-G, 34 supported fixtures, 55 rejected fuzzy fixtures,
  request validation, errors, retries, metadata and existing routing.
- `node --test scripts/test-archivist-voice.cjs`, with the donor path supplied:
  21/21 passed. Initial invocation lacked the required donor-path environment
  variable; rerunning with it resolved the checkpoint-comparison failure.
- `node scripts/check-site-chrome.cjs`: passed on all 18 baseline pages.
- Design artifact checks: JSON parses, schema references resolve within each
  tool schema, examples are consistent, and A01-A30 are unique and sequential.
  These are structural checks, not full JSON Schema conformance validation.
- All provider calls in those checks were mocked. No live Gemini request,
  deployed endpoint test, ChatGPT connection or answer-quality evaluation was
  performed in this step.

## Prototype Implemented And Verified

The isolated `codex/archivist-chatgpt` branch is based on the verified main
commit above. The original dirty checkout remains untouched by this phase.

- `lib/archivist-core.mjs` holds the original instructions, registry and mapper,
  plus the shared query transport. `_worker.js` imports it while preserving the
  website's existing response format. New server/prototype directories are
  blocked from publication asset serving. Existing test harnesses inline that
  module when loading their data-URL Worker fixtures.
- `integrations/archivist-chatgpt` implements both tools, the official SDK
  Streamable HTTP handler, JSON Schema input/output validation, a Node server,
  and a separate Cloudflare Worker. The grounding gate rejects the entire
  plugin reply when any answer-referenced source is invalid.
- Standalone schema validators are generated at build/test time. The runtime
  does not compile schemas dynamically, permitting Cloudflare execution.
- Prototype suite: 55 tests pass, including real SDK HTTP calls and a
  Cloudflare-runtime query with intercepted Gemini responses. This does not
  establish live Gemini answer quality.
- Live SDK smoke check: all 11 approved pages fetched and extracted. Archive
  query is an explicitly marked offline fixture. Results are recorded in
  `integrations/archivist-chatgpt/artifacts/demo-smoke.json`.
- About HTML is approximately 2.93 MB because of inline portrait data. The
  proposed 1 MiB HTML bound was revised to 4 MiB, and inline media attributes
  are removed before constructing the editorial DOM. Output remains bounded
  at 60,000 text characters; no silent truncation occurs.
- Shared-core website regression: text/citation, subscription, 21 voice tests,
  browser checks across 18 pages in both themes and mobile/desktop widths,
  and site chrome pass. No HTML, CSS or browser assets changed.
- Wrangler dry-run bundles the separate Worker, and local Cloudflare runtime
  discovery, safe missing-secret behavior and live entry fetching work.
  No deployment was performed.
- `npm audit --omit=dev` reported zero runtime dependency vulnerabilities at
  verification time. This is a dated check, not a continuing guarantee.

The user's live smoke test at 13:01 UTC on 9 October 2026 returned grounded,
with three canonical sources and 11/11 live entry fetches. The answer
incorrectly called a framework Entry #02. The adapter now appends a public
source-identity catalogue to the locked instructions and suppresses replies
with Entry numbers absent from their supported Entry sources. Ordinary website
instructions remain unchanged. A fixture reproduces the observed mislabelling.
The user's live retest at 13:10 UTC returned grounded with correct Entry #01
and framework labels, three valid source links and 11/11 fetches. Query time
was 8.4 seconds. Broader answer-quality review remains pending.

Working credential metadata: Default Gemini API Key, Default Gemini Project.
The user entered its value in their local Command Prompt; no secret was read,
copied, created or rotated by the agent. There is no Gemini key in the agent's
execution environment. Remaining: reachable development endpoint,
actual ChatGPT connection and connected acceptance. No commit, push or
publication was performed.

## Implementation Sequence

1. Start from freshly verified main in an isolated checkout. Extract core
   functions and prove website response parity with the existing suites.
2. Add the stricter plugin grounding gate with raw-metadata fixtures,
   especially the mixed known/unknown case.
3. Implement bounded, allowlisted entry fetching and repair/adapt extraction.
4. Add the SDK transport and the two tools; run fixture tests and MCP Inspector.
5. Connect a development endpoint as a personal ChatGPT plugin and run the
   connected acceptance scenarios. Deployment/connection credentials and
   account availability are checked at that stage.
6. Prepare the final reviewable implementation and results. Commit, push,
   production publication and public directory submission remain separately
   authorized actions.

## Official References

- [Build An MCP Server](https://developers.openai.com/plugins/build/mcp-server):
  official SDK, Streamable HTTP, tool descriptors/annotations and Inspector.
- [Plugin Quickstart](https://developers.openai.com/plugins/quickstart):
  personal plugin connection and ChatGPT Work testing without custom UI.

The archive stays on Gemini for V1. The model selected for development in
Codex is independent of both ChatGPT's host model and the archive's model.
