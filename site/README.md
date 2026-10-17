# Capitol Tape — website

The download page for the extension. Plain HTML, CSS and JavaScript. A tiny build step (`scripts/build-site.mjs`, no dependencies) glues the shared pieces into each page and writes the finished site to `site/dist/`.

```sh
npm run build:site     # writes site/dist
npx serve site/dist    # preview at http://localhost:3000
```

## Folders

| Folder | What is inside |
|---|---|
| `src/pages/` | One file per page: `index`, `pricing`, `faq`, `changelog`, `login`, `account` |
| `src/legal/` | Legal and trust pages: `privacy` (the store listing links to this one), `terms`, `data` (Data & Disclaimers), `security` (permissions and how to report a problem) |
| `src/components/` | Shared pieces: `Head`, `Header`, `FooterLegal`, `LogoMark`, `Hero`, `ProductDemo`, `PlatformBadges`, `SignalIcons`, `SignalBox`, `PricingCard`, `Feature`, `TrustStrip` |
| `src/js/` | Scripts: `site.js` (shared), `demo.js`, `reveal.js`, `login.js`, `account.js` |
| `src/styles/` | `styles.css`, all the styling for every page |
| `public/` | Copied as-is: `mark.svg` (the favicon), `icon.png` (fallback, from `public/icon/128.png` at the repo root) and `logos/` |
| `dist/` | The built site. Made by the build, never edited, not committed |

HTML files hold only HTML. CSS and JavaScript live in their own files. Colours, type and spacing follow `docs/brand-voice.md`.

## How a page uses a component

```html
<!-- @include Head title="Pricing — Capitol Tape" description="…" canonical="pricing.html" -->
<!-- @include Header -->
```

A block include wraps content, and the component places it where it says `{{children}}`:

```html
<!-- @include PricingCard name="Pro" price="$8" … -->
  <!-- @include Feature -->Unlimited watchlist<!-- @end Feature -->
<!-- @end PricingCard -->
```

Use single quotes around an argument whose value holds HTML: `tag='<span class="tag">Recommended</span>'`.

The build swaps each marker for the file in `src/components/`. Inside a component, `{{title}}` is replaced by the matching argument. `{{base}}` is `""` for top-level pages and `"../"` for pages in a sub-folder, so links work from anywhere. A missing component or an unknown `{{value}}` stops the build.

## Settings (env vars at build time)

| Variable | What it sets |
|---|---|
| `SITE_CHROME_URL`, `SITE_FIREFOX_URL` | Store links on every Add to Chrome / Firefox button. Empty: the buttons scroll to the bottom of the page |
| `SITE_AUTH_BASE` | Address of the Worker that handles sign-in, no trailing slash. Empty: sign-in says it is not switched on yet |
| `SITE_CONTACT_EMAIL` | Contact links. Empty: a placeholder |

These are public values. **Never put a secret here**: everything in them ends up in `config.js`, which anyone can read. For the live site, set them as GitHub repository *variables* (Settings > Secrets and variables > Actions > Variables).

## Before going live

1. Set `SITE_CHROME_URL` and `SITE_FIREFOX_URL` once the listings are live.
2. Set `SITE_CONTACT_EMAIL`. It fills every contact, support and security link. To show social links, add them to `src/components/FooterLegal.html` (they were removed while they pointed nowhere).
3. Have a lawyer read `terms`, `privacy` and `data`. The Terms have no governing-law section yet on purpose.
4. Replace the three testimonials with real reviews. They are made up and marked as illustrative on the page.
5. To switch sign-in on, follow "Website sign-in" in `worker/README.md`, then set `SITE_AUTH_BASE`.

## Publish

Address: **https://capitol-tape.pages.dev** (works after the first deploy below).

GitHub publishes the site to Cloudflare Pages by itself (`.github/workflows/deploy-site.yml`) every time `site/` or the build script changes on `master`. It builds first, then publishes `site/dist`. You can also run it by hand from the Actions tab ("Deploy site" → "Run workflow").

One-time setup, in the GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Pages" template (or a custom token with *Account → Cloudflare Pages → Edit*) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → the Account ID in the right sidebar |

From your own computer instead: `npx wrangler login`, then `npm run build:site && npx wrangler pages deploy site/dist --project-name=capitol-tape`.

## Logos

`public/logos/` holds the logos shown in the broker cards and the "Works where you already trade" strip.

| Files | Where they came from |
|---|---|
| `tradingview.svg`, `robinhood.svg`, `chrome.svg`, `firefox.svg`, `github.svg` | The [Simple Icons](https://simpleicons.org) set (CC0 licence), coloured by us |
| `webull`, `schwab`, `interactivebrokers`, `sofi`, `fidelity`, `etrade`, `vanguard`, `public` (`.svg`) | **Placeholders we drew**: a grey tile with the company's initial. No open-licence logo exists for these. |

To show a company's real logo, save its official SVG over the matching file in `public/logos/` (same file name). Use only the press or brand-kit file the company publishes, and check its brand rules first. The Google "G" on the sign-in button is Google's own four-colour mark, drawn inline in `src/pages/login.html`.

All logos and names belong to their owners. The page says it is not affiliated with any of them.
