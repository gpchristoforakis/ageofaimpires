# TinaCMS and Cloudflare Pages

This project uses TinaCMS in local mode during development and Tina Cloud for
production editing. Cloudflare Pages serves the generated static site and the
Tina admin from `public/admin`.

## Local development

Install dependencies, then run:

```sh
npm run dev
```

Open <http://localhost:4321/admin/index.html> to edit content. Tina writes changes
directly to the matching files under `src/content`.

Article bodies and the About page are also wired for visual editing. Open a
document in the admin and use its preview; the editable body region is marked
on the public page and can be clicked to focus the matching Tina field.

For a local production build without Tina Cloud credentials, use:

```sh
npm run build:local
```

## Tina Cloud

Create a project at <https://app.tina.io>, connect it to the GitHub repository,
and copy its client ID and read/write token into the Cloudflare Pages project
settings. Add these variables for the production and preview environments:

| Variable | Value |
| --- | --- |
| `PUBLIC_TINA_CLIENT_ID` | Tina Cloud client ID |
| `TINA_TOKEN` | Tina Cloud read/write token |
| `TINA_BRANCH` | Optional branch override; Cloudflare's `CF_PAGES_BRANCH` is used by default |

Do not commit the token or put it in a `PUBLIC_` variable.

## Cloudflare Pages build settings

Use the following settings in **Workers & Pages → your project → Settings →
Builds & deployments**:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Cloudflare Pages rebuilds the site after Tina Cloud commits an edit to GitHub.
Preview deployments use the branch supplied by `CF_PAGES_BRANCH`.

The Cloudflare adapter is required for Tina's on-demand island endpoint. Keep
the Pages output directory as `dist`; the adapter produces the client assets
and Worker entrypoint inside that directory.
