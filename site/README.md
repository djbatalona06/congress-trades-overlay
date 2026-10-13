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

Any static host works. With Cloudflare Pages: `npx wrangler pages deploy site`.
