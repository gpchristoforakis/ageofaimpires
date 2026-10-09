# The Archivist Public Release Candidate

9 October 2026. The user reports that OpenAI developer verification is complete.

## Current Hosted Service

- Worker: `aoai-archivist-mcp`, separate from the existing website and hosting test.
- URL: https://aoai-archivist-mcp.christoforakis.workers.dev/mcp
- Deployed version: `355bc656-d554-45c0-82ba-cf3533659860`.
- `ARCHIVIST_QUERY_ENABLED=false`; no Gemini secret was supplied by the agent.
- Live SDK discovery and fetching of all 11 published pages passed. Query calls
  return a safe disabled response. See `artifacts/public-hosted-check.json`.
- 62 tests passed, including a real workerd runtime with mocked Gemini,
  concurrent reservations, persistent counts after a restart, missing/invalid
  budget failure, retry counting, UTC resets and fetch access after exhaustion.

## Usage Controls

The SQLite-backed Durable Object stores one counter record, shared by every
Worker instance. A permit is consumed before each actual Gemini attempt,
including retries and failed attempts. Limits are 25 per UTC day and 250 per
UTC calendar month. Missing or failed budget checks block the Gemini request.
The provider payload caps output at 2,048 tokens. These are request/output
limits, not a guarantee of zero Google charges or a currency spending cap.

The budget stores no questions, answers, credentials or user identities.
The adapter sends a self-contained query to Google Gemini File Search and
returns its grounded result to the calling ChatGPT client. It does not send
the complete chat history. Cloudflare invocation metadata logging is enabled;
application code does not log request bodies, model results or keys.

## User Handoff

The Cloudflare settings tab is open at:
https://dash.cloudflare.com/2dfd4a1280d60d715d095a4c82a6c5e1/workers/services/view/aoai-archivist-mcp/production/settings

The unsaved Add environment variable form has `GEMINI_API_KEY` as its Key,
Production selected, and Secret checked. The user must enter the working
Default Gemini API Key from Default Gemini Project into Value and submit
Add 1 variable and deploy. No credential values should enter the chat.
Adding the secret does not activate queries while the enable variable is false.

After the key is stored, inspect secret names only and the public health response.
Confirm the intended Gemini tier/quota, then activate the bounded hosted service
and run `node scripts/check-public-hosted.mjs --live`. Update wrangler.jsonc when
changing the enable variable, so a later deploy does not unintentionally reset it.
Keep the existing private ChatGPT tunnel until the hosted connection passes.

## Plugin Candidate

The portable package is under `integrations/archivist-chatgpt/plugin/`.
ZIP: `integrations/archivist-chatgpt/artifacts/the-archivist-public-candidate-0.2.0.zip`.
It contains exactly `plugin.json`, `mcp.json` and `assets/icon.png`; no secrets,
local paths, private tunnel or registered app reference. The PNG reuses the
publication's existing favicon. Five positive and three negative review cases
are supplied as intended acceptance criteria; they are not claims that the new
hosted live service has already passed those cases.

## Still Required Before Public Submission

1. Activate and verify the live hosted archive, including new ChatGPT connection.
2. Update the public privacy disclosure for the actual plugin data flow to
   OpenAI, Cloudflare and Google; the current site policy does not mention Gemini.
   Verify the actual Google tier and retention settings before describing them.
3. Upload the candidate as a draft under the user's verified publisher identity;
   complete the portal's domain challenge. The Worker already supports serving
   `OPENAI_APPS_CHALLENGE` at `/.well-known/openai-apps-challenge` as plain text.
4. Resolve portal metadata/tool checks, run the five positive and three negative
   cases against the live hosted plugin, and provide a real video walkthrough.
5. Confirm intended country availability and complete the required submission
   attestations. No draft upload, review submission or directory publication has
   happened. User approval is required for final public publication.

Official submission guide: https://developers.openai.com/plugins/deploy/submission

No new site-page edits, commits or pushes were made in this preparation step.
