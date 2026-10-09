# Archivist Voice Preview

Starting production commit: `e353bb0ba537b6bdec76e18469186f2dc9343753`.
Donor checkpoint: `b9af7bf9fab676ec042615d88d9770468e7c1d28` on
`archivist-voice-debug`. This adds voice to the existing static panel; it does
not replace text chat or add a site build step.

## Browser

The small vanilla controller loads when the panel opens. Only an explicit
Start Voice action requests microphone permission and starts audio contexts.
The browser SDK loads on Start Voice. SDK 2.27.0 is served locally from
`assets/vendor/google-genai-2.27.0.js`; licence notices are beside it. This
static ESM artifact was bundled once from the donor's locked `dist/web/index.mjs`
and its `p-retry` / `retry` dependencies using the donor's existing esbuild.
No package manifest, installation, CDN dependency or deployment build command
is required. Future SDK updates must preserve the reviewed licence notices.

The model, system instruction, AUDIO modality, Aoede voice, transcriptions,
queryArchive declaration, v1alpha and sessionResumption configuration are
ported from the checkpoint. The production page's WebSocket constructor was
observed to be native. The SDK uses its ordinary browser transport; its
instance factory is only tracked to close a handshake cancelled before the
SDK returns a session. No iframe workaround, global WebSocket replacement,
URL rewriting, diagnostic frame logging or React code is included.

PCM streams only after SDK connect resolves with setupComplete. Microphone
input is mono 16kHz signed 16-bit little-endian PCM. Model PCM playback is
24kHz, queued through AudioContext. Local speech and server interruption stop
queued playback. End Voice, panel close, pagehide, errors, cancellation and
three-minute inactivity release tracks, processors, contexts and sockets.
Startup is bounded by a 20-second token request and 30-second handshake timer.
No automatic reconnection or extra application retries are added.

## Worker Token Route

`POST /api/voice/token` accepts an empty JSON object from the same origin.
It uses only Cloudflare's server-side `GEMINI_API_KEY`, calls
`https://generativelanguage.googleapis.com/v1alpha/auth_tokens`, and preserves
the donor settings: one use, 30-minute expiry, two-minute new-session expiry,
without additional constraints. Only the returned ephemeral name is sent to
the browser as `{ token }`. Responses are no-store, and provider errors are
replaced with safe structured JSON. There is no Node dependency in the Worker.

The same existing secret must be available in the **Preview environment**.
Production and Preview settings are separate. No key was created, rotated,
copied into code or changed by this integration. A missing binding returns
503 with `voice_not_configured`; text chat continues to use its existing route.

## Archive Bridge

Live queryArchive calls POST to the existing production `/api/chat`, with the
query, empty history as in the donor bridge, and the existing bounded page
context. That route's model, prompt, File Search store and strict supported
11-source mapping are unchanged. Its reply is returned as the Live tool
response; only its sources can populate voice cards. Source state is cleared
between turns/sessions. Live metadata, answer text and guessed titles do not
create source cards. Errors preserve the archive-unavailable limitation.

## Validation And Accepted Limits

Run the existing site, Worker/chat, subscription and browser checks, plus
`node --test scripts/test-archivist-voice.cjs`. Set `ARCHIVIST_DONOR_PATH` to
the donor checkout for checkpoint comparisons. Browser tests use an existing
Playwright/Edge installation and offline SDK/audio fixtures, not credentials
or a real microphone. The original text tests and source fixtures remain.

AI Studio's real basic audio, grounded Completion Boundary, archive limitation,
phatic conversation, barge-in and End Voice during speech were verified before
this port. The remaining long manual cleanup tests are not a release gate at
the user's direction. Offline cancellation/inactivity/pagehide checks support
the implementation; real Cloudflare audio remains subject to the short smoke
test below. No production merge or manual production deployment is authorized.

## Four-Step Preview Smoke Test

1. Open The Archivist and click Start Voice. Allow microphone access. Expect
   Connected and Microphone Active.
2. Say “Can you hear me?” Expect audible Aoede output and both transcripts.
3. Ask “What is the Completion Boundary?” Expect a grounded spoken answer and
   legitimate archive sources returned by `/api/chat`.
4. Click End Voice. Expect audio to stop, the microphone indicator to disappear
   and the connection to close.
