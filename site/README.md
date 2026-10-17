# Capitol Tape — website

The download page for the extension. Plain HTML and CSS, no build step.

| File | What it is |
|---|---|
| `index.html` | Landing page: hero with the demo chart, brokers, features, FAQ, install buttons |
| `pricing.html` | The three plans |
| `login.html` | Sign in or create an account with Google or GitHub |
| `account.html` | Shows who is signed in, with a Sign out button |
| `privacy.html` | Privacy policy (the store listing links to this) |
| `styles.css` | All the styling for every page |
| `config.js` | The two things you fill in by hand: store links and the Worker address |
| `site.js` | Shared: header menu, "Desktop only" notice on the Add to Chrome buttons, footer year |
| `demo.js` | Draws the demo chart in the hero (home page only) |
| `reveal.js` | Fade-in on scroll and number counters (home and pricing) |
| `login.js`, `account.js` | The sign-in and account pages talk to the Worker |
| `logos/` | Brand logos, see below |
| `icon.png` | Favicon, copied from `public/icon/128.png` |

HTML files hold only HTML. CSS and JavaScript live in their own files.

## Before going live

1. Paste the store links into `INSTALL_URLS` in `config.js`. Until then, the install buttons scroll to the bottom of the page. On phones and tablets they open a "Desktop only" notice instead.
2. Replace `hello@example.com` (two places) and the `#` social links with real ones.
3. Replace the three testimonials with real reviews. They are made up and marked as illustrative on the page.
4. Fill the contact line in `privacy.html`.
5. To switch sign-in on, follow "Website sign-in" in `worker/README.md`, then set `AUTH_BASE` in `config.js`.

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

## Logos

`logos/` holds the logos shown in the broker cards and the "Works where you already trade" strip.

| Files | Where they came from |
|---|---|
| `tradingview.svg`, `robinhood.svg`, `chrome.svg`, `firefox.svg`, `github.svg` | The [Simple Icons](https://simpleicons.org) set (CC0 licence), coloured by us |
| `webull`, `schwab`, `interactivebrokers`, `sofi`, `fidelity`, `etrade`, `vanguard`, `public` (`.svg`) | **Placeholders we drew**: a grey tile with the company's initial. No open-licence logo exists for these. |

To show a company's real logo, save its official SVG over the matching file in `logos/` (same file name). Use only the press or brand-kit file the company publishes, and check its brand rules first. The Google "G" on the sign-in button is Google's own four-colour mark, drawn inline in `login.html`.

All logos and names belong to their owners. The page says it is not affiliated with any of them.
