# The Archivist MCP Prototype

Local prototype, 9 October 2026. Two read-only tools:

- `query_archive`: existing Gemini File Search retrieval, locked Archivist
  instructions, strict supported-source gate and public canonical citations.
- `fetch_entry`: cleaned current publication text for an exact approved ID.

The publication website and plugin share the same archive core. The MCP server
is a separate endpoint. The personal ChatGPT plugin is connected through a
private Secure MCP Tunnel. Four user-facing answer scenarios and additional
injection/missing-entry checks passed review. A separate Cloudflare hosting-check
Worker is deployed with Gemini generation disabled. Its live SDK check fetches
all 11 published pages. Production hosted queries are not yet enabled. The
authorized About portrait extraction is published through PR #12: HTML is now
about 36 KB and the image is preserved. Its latest successful hosted CPU sample
is 8 ms, down from 60 ms. The Cloudflare dashboard confirms Workers Free.

## Try The Standalone Package

Requires Node 24 or newer. The packaged JavaScript includes its dependencies;
no npm installation is needed for these commands.

```powershell
node ./archivist-smoke.mjs
```

This starts a temporary local MCP server, connects with the official SDK,
executes a clearly marked simulated Completion Boundary query, and fetches
all 11 approved entries from the real publication. It shuts down afterwards
and saves `artifacts/demo-smoke.json`, including the answer, citations and a
complete sample fetched entry. It makes no paid Gemini calls.

To keep a local MCP endpoint running:

```powershell
node ./archivist-server.mjs --demo
```

Endpoint: `http://127.0.0.1:8787/mcp`. Health: `http://127.0.0.1:8787/`.
Archive query answers are simulated in demo mode. Entry fetching is live.
Demo text and metadata identify this explicitly. Do not publish demo mode.

For live archive queries, supply a server-side `GEMINI_API_KEY` with access to
the existing archive store and launch without `--demo`. The standalone live
server reads that environment variable and does not write it to disk. Node's
`--env-file` option can read an existing protected credential file if needed.
Never put credentials in plugin instructions, a URL, this package or Git.

```powershell
node ./archivist-server.mjs
```

Without the Gemini secret, `fetch_entry` still works and `query_archive`
returns a safe configuration error. No fallback answer is invented.

Read-only access diagnostics (key values are not printed):

```cmd
node archivist-diagnose.mjs
node archivist-diagnose.mjs --stores
```

The 9 October live test found the configured archive using **Default Gemini
API Key** in **Default Gemini Project**. These are display labels, not secret
values. The key named AI AGENT in TheStudio CY listed zero stores. The user
entered the working credential in their own Command Prompt session.

The first live query returned grounded and fetched 11/11 pages. Review found
an incorrect Entry #02 label on a framework. The updated adapter supplies the
public source catalogue and rejects unsupported Entry numbers; that update
passes its regression fixture and the user's live retest. The latter correctly
names Entry #01 and the framework separately, with three valid source links
and 11/11 fetches. ChatGPT is now connected through the private local tunnel;
broader repeatability and a real tunnel outage/recovery check remain pending.

## Develop From Source

From `integrations/archivist-chatgpt` in the repository worktree:

```powershell
npm ci --ignore-scripts
npm test
npm run smoke
npm run build
```

`npm test` generates standalone JSON Schema validators and runs the prototype
tests. Runtime validation requires no dynamic schema compilation. The SDK
handles MCP negotiation and transport; the tool layer validates both inputs
and outputs against the contract JSON. Dependencies and versions are locked.

The bundled source is rebuilt into `dist/`. Third-party licences accompany the
standalone files. Root `lib/archivist-core.mjs` contains the locked configuration,
registry, source mapper and query transport shared with `_worker.js`.

## Cloudflare Runtime

`src/worker.mjs` is a separate Worker entry point. `wrangler.jsonc` names the
prototype `aoai-archivist-mcp`. It does not overwrite the publication Worker.

```powershell
npx wrangler deploy --dry-run --outdir .wrangler/bundle
npx wrangler dev --local --ip 127.0.0.1 --port 8798
```

These commands bundle and run locally. An actual deployment requires explicit
authorization; live archive queries require a Gemini secret on the new Worker. The website's existing
secret is not automatically shared with another Worker. No deployment command
for the production-query Worker has been run by this task. The separately
authorized `aoai-archivist-free-test` Worker is deployed.

For a separate hosting verification with Gemini disabled in code, use
`wrangler.free-test.jsonc`. Its local runtime check fetches all 11 public pages
without provider generation. The About-page asset update reduces its local fetch
median to 2 ms after the direct DOM-walk optimization. See `docs/archivist-chatgpt-deployment.md` in the source overlay
for the prepared deployment scope, account sign-in and remaining hosted checks.

V1 is anonymous and public. The endpoint permits server calls without Origin;
browser Origins must match the server or an explicit `MCP_ALLOWED_ORIGINS`
allowlist. Local Node mode binds only to loopback and validates Host. Public
proxy/tunnel hosts require deliberate configuration in the source server.
Do not use wildcard browser CORS to make a connection work.

Requests are capped at 64 KiB; query inputs at 4,000 characters. Query execution
has a 60-second deadline and the existing bounded retries. Entry fetching has
a 20-second deadline, 4 MiB HTML limit, 60,000-character text limit and at most
three approved redirects. Limits return errors rather than silent truncation.

The basic limiter allows 60 MCP requests/minute and two active operations per
Node process or Cloudflare isolate. It is not a distributed abuse control or a
provider budget cap. Public rollout still needs appropriate Cloudflare and
Gemini quota/budget configuration. No reader accounts or persistent conversation
store are introduced.

## Connect To ChatGPT

A local loopback URL alone cannot be used by ChatGPT's remote servers. The current
personal plugin uses the Secure MCP Tunnel already configured on this computer.
Use the personal-plugin workflow first; public-directory submission is later.

1. Make the live development MCP endpoint reachable with authorized hosting
   or the supported private tunnel.
2. In ChatGPT Plugins, add the custom MCP server using its `/mcp` URL. V1 uses
   no user authentication because it exposes only public archive material.
3. Install the personal plugin and invoke it in ChatGPT Work.
4. Run the connected acceptance scenarios in
   `docs/archivist-chatgpt-v1.md`: concepts, follow-ups, distinct framework
   sources, exact quotations, unsupported topics and failures.
5. Record actual tool calls, source fidelity, answer quality and latency.

Official guides:
[Build An MCP Server](https://developers.openai.com/plugins/build/mcp-server)
and [Connect And Test Your Plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Evidence And Limits

The prototype tests exercise grounded and unsupported queries, mixed
known/unknown sources, identity collisions, invalid input, retries, safe errors,
real SDK HTTP transport, extraction, redirects, response bounds and cancellation.
Source text containing instructions stays source data; tests do not prove a
ChatGPT host model will resist every injection. That requires connected testing.

The grounding gate verifies structural source support. It does not prove that
every generated clause is entailed by the cited entry. V1 exposes entry-level
citations; exact quotations require fetching and matching the published text.
File Search is the current 11-document snapshot. `fetch_entry` reads the live
site and does not synchronize the snapshot or expose drafts.

Existing website text/citation, subscription, voice, browser and site-chrome
checks also pass after the shared-core extraction. The original dirty checkout
was preserved, with only the authorized portrait source and asset synchronized.
The About image update was committed, merged and published in PR #12. The separate
Cloudflare test Worker is deployed, with live hosted queries disabled. ChatGPT is
connected privately; detailed evidence is in the source handoff document.
