# Capitol Tape — website

The download page for the extension. Plain HTML and CSS, no build step.

| File | What it is |
|---|---|
| `index.html` | Landing page: hero, features, pricing, FAQ, install buttons |
| `privacy.html` | Privacy policy (the store listing links to this) |
| `icon.png` | Favicon, copied from `public/icon/128.png` |

## Before going live

1. Paste the store links into `INSTALL_URLS` at the bottom of `index.html`. Until then, the install buttons scroll to the bottom of the page.
2. Replace `hello@example.com` (two places) and the `#` social links with real ones.
3. Replace the three testimonials with real reviews. They are made up and marked as illustrative on the page.
4. Fill the contact line in `privacy.html`.

## Preview locally

```sh
npx serve site
```

## Publish

Address: **https://capitol-tape.pages.dev** (works after the first deploy below).

GitHub publishes this folder to Cloudflare Pages by itself (`.github/workflows/deploy-site.yml`) every time `site/` changes on `master`. You can also run it by hand from the Actions tab ("Deploy site" → "Run workflow").

One-time setup, in the GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Pages" template (or a custom token with *Account → Cloudflare Pages → Edit*) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → the Account ID in the right sidebar |

From your own computer instead: `npx wrangler login`, then `npx wrangler pages deploy site --project-name=capitol-tape`.
