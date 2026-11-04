# Site-Wide Comments

Comments publish immediately, as requested. The shared component is mounted on all 19 content pages: Entries, frameworks and tools, Guides, Notebook, directories, homepage and About. Contact retains its private message form; legal pages have no comment thread.

## Behaviour

- Display name and comment only; no email collection or account dependency.
- Explicit agreement to public publication. Plain text rendering; HTML is never executed.
- Each page has its own thread. Extensionless and `.html` routes resolve to the same thread.
- Newest comments first, 20 per page, with a Load More control.
- A submission UUID prevents duplicate comments after a lost response/retry.
- Five submission attempts per connection IP per UTC day. Shared connections share this allowance. Repeated retries count toward the allowance, but an already-saved UUID still returns success.
- A daily keyed HMAC is stored instead of the raw IP. Expired rate records are removed on subsequent submissions. A honeypot and same-origin checks provide additional abuse resistance; these are not bot-proof.
- Database errors leave drafts intact. A missing database or rate secret returns an explicit unavailable response, never false success.

## Production Setup Status — 4 November 2026

The production setup is complete on the Cloudflare Pages project `ageofaimpires`:

- D1 database: `ageofaimpires-comments`, jurisdiction `eu`.
- Database ID: `2013ce0d-5d44-4506-b254-670482e3034e` (an identifier, not a credential).
- `migrations/0001-comments.sql` applied; `comments` and `comment_limits` verified, with zero comments.
- Production binding: `COMMENTS_DB`.
- `COMMENTS_RATE_SECRET` generated privately and stored as an encrypted production secret. Its value is not stored in the repository.
- Existing production settings/secrets and preview settings were verified unchanged.
- No deployment was triggered. The live comments API still requires the approved website code to be released.

## Setup Reference For A New Environment

Production is already configured; do not recreate it or rotate its secret merely to deploy. Keep preview and production databases separate.

1. Create the production D1 database, for example `npx wrangler d1 create ageofaimpires-comments`.
2. Apply `migrations/0001-comments.sql` to that database: `npx wrangler d1 execute ageofaimpires-comments --remote --file=migrations/0001-comments.sql`.
3. In the website's Cloudflare Pages project, add the production D1 binding **COMMENTS_DB** pointing to that database. Add a separately generated private **COMMENTS_RATE_SECRET** as an encrypted environment secret. Do not put it in Git or chat.
4. For a deployed preview, use a separate D1 database and secret in the preview environment. Local development below needs neither.
5. After release authorization, deploy the website Worker and assets, then verify a real submission, page isolation, reading and deletion. Remove the smoke-test comment afterward.

Use the existing Pages dashboard configuration rather than introducing a replacement hosting configuration. Cloudflare reference: https://developers.cloudflare.com/d1/worker-api/d1-database/

## Review And Removal

There is no public admin endpoint or admin key in the browser. Use the authenticated Cloudflare D1 console or Wrangler. Read the comment first, then remove only the confirmed ID:

```sql
SELECT id, page, name, comment, created_at FROM comments ORDER BY id DESC LIMIT 50;
SELECT id, page, name, comment FROM comments WHERE id = 123;
DELETE FROM comments WHERE id = 123;
```

Replace `123` with the actual ID. For example, `npx wrangler d1 execute ageofaimpires-comments --remote --command="SELECT id, page, name, comment FROM comments ORDER BY id DESC LIMIT 50"` lists recent submissions. There are no automated email notifications. Review new comments regularly; handle removal requests sent to the publication's existing contact email.

## Local Preview And Checks

`node scripts/comments-preview-server.cjs 49855` serves the complete site with a real SQLite-backed comments API at http://127.0.0.1:49855/. Comments exist in memory and disappear when the server stops. All other backend APIs are unavailable in this isolated preview, so tests cannot send messages or subscriptions.

`node scripts/test-comments.cjs` exercises SQL storage, validation, page isolation, immediate publication, consent, origin checks, retry deduplication, limits and pagination.

`node scripts/test-page-controls-browser.cjs` uses Playwright and Microsoft Edge to check the comment UI, narration error/retry state and back-to-top controls. It starts and stops its own isolated local server. Playwright must be available through Node's module resolution (the Codex runtime provides it; no site dependency is added).
