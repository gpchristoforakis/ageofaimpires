# The Archivist v0.2.2 — Release Record

Released: 27 October 2026

Status: Published and active in production.

## Source and production

- Repository baseline: `origin/main` at `8acd41b33d69bab23e17ff41c029486398ebe47f`, including merged website PR #16.
- Technical baseline: the isolated Stage 3 source used for the successful production activation.
- Worker: `aoai-archivist-mcp`.
- Production deployment: `6e45e1b3-b1c4-46b0-b855-77718615b14b`.
- Production Worker version: `2cf18509-54e0-453c-beb6-8a7144d9bcbf` at 100% traffic.
- Immediate rollback version: `492cb96b-6526-489f-bd29-fae204a78936`.
- Production configuration: query enabled; hybrid discovery enabled; 50 provider attempts per UTC day and 500 per UTC month; existing Gemini secret and Durable Object binding preserved.

## Marketplace package

- Marketplace version: `0.2.2`.
- Published package: `The-Archivist-v0.2.2-RELEASE.zip`.
- Package SHA-256: `E53171C792F8CC503D9B2F8A9B3D06C548BB9C16C31D6A55DFD34805B6071F80`.
- `plugin.json`: 6,094 bytes; SHA-256 `9338CC02B067809B69C16BA57D9BD041BEAEEE9BDF990CF478D4DF589640E20E`.
- `mcp.json`: 238 bytes; SHA-256 `821B4DCA5497F94E4EFC1B26BF668117B8B480EF533C55E258AC5BD0822FE03F`.
- `assets/icon.png`: 15,957 bytes; SHA-256 `CB7638DAEA7F266D6AFE2CE9407A3BDCFAFE5D4948D096DD020374E8C3CA1B9D`.
- The repository manifest is byte-identical to the published `plugin.json`. The existing `mcp.json` and icon already matched the published package and were not changed.
- The published `longDescription` supersedes the earlier final-review ZIP wording; this is the only semantic manifest difference between those two v0.2.2 packages.

## Released behaviour

- Public tools remain exactly `query_archive` and `fetch_entry`.
- Accepted tool-definition SHA-256: `34AC763FEC2B86EFF136CC7CBAE1FB8F7F80839EDA7BF7C8627E26B02798A73B`.
- Beginner discovery returns only The Effective Task Cost Framework after live-page verification.
- Assistant comparison returns The Effective Task Cost Framework, Entry #01, and the Operator's Deep Dive in that order after live-page verification.
- Curated results use `content_origin: live_site` and `selection_origin: curated` without a Gemini provider call.
- General archive questions continue through Gemini File Search with `content_origin: file_search`.
- Canonical registry validation, strict source validation and fail-closed behaviour remain active.

## Release verification

- OpenAI MCP scan: reported no findings before publication.
- Reader-facing acceptance: both curated paths, general File Search, published-page retrieval and error handling passed in production.
- Integration suite: 76/76 passed after validator regeneration.
- Contract validation: all six input/output examples passed; contract version remains `0.2.0`.
- Marketplace manifest: parsed successfully; three approved starters, five positive cases and three negative cases verified.
- Wrangler dry-run: passed; 1,018.31 KiB upload and 219.56 KiB gzip with hybrid discovery enabled.
- Repository shared-site check: passed on 18 pages.

This record reconciles the repository with the published release. It does not represent a new deployment, marketplace submission or behavioural change.
