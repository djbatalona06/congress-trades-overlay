# Site launch spec, 2026-10-17

The plan to get the Capitol Tape website (and a little of the extension) ready for a public launch. It covers styling, brand, marketing, project structure, legal and trust. It sits on top of `2026-10-13-prd-delta.md`.

It is written as the six project documents: PRD, TRD, App Flow, UI/UX brief, Backend schema, Implementation plan. Sections 7 to 9 hold the legal review, the marketing plan, and the places where this plan deliberately differs from the review notes it started from.

---

## 0. Summary

| # | Pull request | Type | Depends on |
|---|---|---|---|
| 1 | This document | Docs | — |
| 2 | Site structure: `src/` pages and components, `public/` assets, a tiny build step, build-time config from env vars | Refactor (no visual change) | — |
| 3 | Brand and visual system: neutral palette, one signal accent set, type, 8px grid, new mark, one-CTA hero, accessible signal box | Styling | 2 |
| 4 | Legal and trust: Terms, Data & Disclaimers, FAQ, Changelog pages, privacy update, trust strip, `SECURITY.md`, `DATA_SOURCES.md`, permissions and platform-terms notes | Legal / content | 3 |
| 5 | Security headers and quality checks: CSP, HSTS and friends; site build, internal link, accessibility and Lighthouse checks in CI; weekly external link check | Security / CI | 4 |
| 6 | Marketing and growth: three SEO guide pages, sitemap, robots, social card, fake testimonials removed, beta-tester section, waitlist with referral codes (Worker + D1) | Marketing / feature | 5 |
| 7 | Extension: a shape icon beside each Quiet / Watch / Hot label, so the level never depends on colour | Accessibility | — |

PRs 2 to 6 are stacked: each one's base branch is the one before it, so every diff shows only its own change. Merge them in order.

**The biggest launch risk is not on the review list:** see 7.1 (5 U.S.C. § 13107(c)). Get a lawyer's answer before charging for Pro.

---

## 1. PRD — what we are building and for whom

**Product.** A browser extension that shows public STOCK Act trade disclosures by members of Congress on stock charts at TradingView, Robinhood, Webull and Schwab. Desktop Chrome and Firefox. The website explains it, builds trust, and sends people to the store listings.

**Positioning.** "Nonpartisan congressional trade data, right on your chart." Three supporting facts, repeated everywhere: public disclosure data; read-only, no brokerage access; information only, not advice.

**Audience.**
1. Retail traders who already use one of the four platforms and follow congressional trading news.
2. Newsletter writers and researchers who compile disclosure roundups.
3. Reviewers: Chrome Web Store and Mozilla reviewers, platform trust teams, journalists. They need permissions, data sources and disclaimers to be easy to find.

**Goals for the site.**
- A visitor understands what it does in five seconds (one headline, one subhead, one button, one picture).
- Every trust question (what data, how late, what permissions, is it advice, who pays whom) has a plain answer one click away.
- Nothing on the site is invented: no fake reviews, no implied trading edge, no party colours as branding.

**Non-goals.** A mobile app (a waitlist only), a hosted data API, copy-trading features, any claim that disclosures predict prices.

**Success measures (first 60 days after store approval).** Store installs; install-button click-through from the home page; waitlist sign-ups; verified reviews collected (target 10); zero store-review rejections for misleading claims.

---

## 2. TRD — tech, tools and APIs

| Area | Choice | Why |
|---|---|---|
| Site | Plain HTML, CSS and vanilla JS | Already in place; fast; nothing to patch |
| Site build | `scripts/build-site.mjs`, Node only, no dependencies | Puts shared pieces (header, footer, signal box…) in one file each, writes `site/dist/` |
| Components | HTML partials in `site/src/components/`, pulled in with `<!-- @include Name -->` | Keeps "HTML files hold only HTML" |
| Config | Build-time env vars → generated `config.js` and `_headers` | Store URLs, Worker address and contact email change per deploy without editing HTML. Only public values; secrets never reach the site |
| Hosting | Cloudflare Pages | Already used; `_headers` file gives security headers for free |
| Backend | Existing Cloudflare Worker + D1 | Adds one route (`POST /waitlist`) and one table |
| Fonts | Inter (UI and body), Source Serif 4 (headlines), Google Fonts | Inter is clean at small sizes; a serif headline reads as "public record", not "trading app" |
| Checks | Vitest (existing), axe-core on built pages (existing dev dependency), Lighthouse CI (`npx @lhci/cli`), internal link checker | Accessibility and broken links are caught on every PR |
| Extension | Unchanged stack: WXT 0.21, React 19 | Only PR 7 touches it |

**Environment variables** (all optional; empty means "not live yet"):

| Name | Used for |
|---|---|
| `SITE_CHROME_URL`, `SITE_FIREFOX_URL` | Store links on every install button |
| `SITE_AUTH_BASE` | Worker address for sign-in and the waitlist; also added to the CSP `connect-src` |
| `SITE_CONTACT_EMAIL` | Contact links on every page (falls back to a clearly fake placeholder) |

GitHub repository **variables** (not secrets) feed these to the deploy job.

---

## 3. App flow — every page and path

```
Home ─┬─ Add to Chrome ─→ Chrome Web Store (desktop) │ "Desktop only" dialog + mobile waitlist (phone/tablet)
      ├─ Also on Firefox ─→ Firefox Add-ons
      ├─ Pricing ─→ Add to Chrome │ Desk waitlist
      ├─ FAQ (page)
      ├─ Guides ─→ How to see congressional trades on TradingView
      │          ─→ STOCK Act disclosures explained
      │          ─→ Congress trade data API
      ├─ Changelog
      ├─ Sign in ─→ Google │ GitHub ─→ Account ─→ Sign out
      └─ Footer legal row: Privacy · Terms · Data & Disclaimers · Security · Contact
```

| Route | Purpose | New? |
|---|---|---|
| `/` (`index.html`) | Hero, platforms, trust strip, features, how it works, FAQ teaser, final CTA | Reworked |
| `/pricing.html` | Free, Pro, Desk (waitlist) | Restyled |
| `/faq.html` | Full FAQ | New |
| `/changelog.html` | Release notes, newest first | New |
| `/data.html` | Data & Disclaimers: source, delay, accuracy, liability, not advice | New |
| `/terms.html` | Terms of Service | New |
| `/privacy.html` | Privacy policy (same URL, the store listing links here) | Updated |
| `/security.html` | Permissions, what is stored, how to report a problem | New |
| `/guides/*.html` | Three SEO guides | New |
| `/login.html`, `/account.html` | Optional website account | Restyled |

**Keyboard and screen-reader paths:** skip link on every page; the grid menu opens with Enter or Space and closes with Esc; every external link says "(opens in a new tab)"; the waitlist form reports success or errors in a live region.

---

## 4. UI/UX design brief

**Feel.** Calm, factual, tool-like. Like a well-made public-records page, not a trading app. Light theme: white, with the logo slate for text and actions.

**Colour.** Everything is neutral except signal states.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0f172a` | Headings, body text |
| `--ink-2` | `#334155` | Secondary text |
| `--muted` | `#475569` | Captions (7.6:1 on white) |
| `--line` | `#e2e8f0` | Borders |
| `--bg` / `--bg-alt` | `#ffffff` / `#f8fafc` | Page / alternate sections |
| `--brand` / `--brand-hover` | `#172536` / `#0b131d` | Buttons, links, focus ring (the logo slate) |
| `--quiet` | `#475569` | Signal: Quiet |
| `--watch` | `#b45309` | Signal: Watch (amber, 5.0:1 on white) |
| `--hot` | `#b91c1c` | Signal: Hot |
| `--buy` / `--sell` | `#15803d` / `#b91c1c` | Only inside trade data |

No red or blue as brand colour. Party badges in the demo are neutral slate with the letter (D, R, I), never coloured by party.

**Type.** Body and UI: Inter, 16px minimum, line height 1.6. Headlines: Source Serif 4, semibold. Numbers: tabular figures.

**Spacing.** 8px grid. Tokens `--s1`…`--s10` = 8, 16, 24, 32, 40, 48, 56, 64, 72, 80px. Radius 8px (controls) and 12px (cards).

**Components.**

| Component | Rule |
|---|---|
| Button | Two kinds only: primary (slate, white text) and secondary (white, slate border). 48px tall, 40px for small. One primary per view |
| Card | White, 1px `--line` border, 12px radius, 32px padding, no hover jump |
| SignalBox | Icon + word + short reason. Quiet = dash in a circle, Watch = eye, Hot = flame. Colour is the third cue, never the only one |
| PlatformBadges | Logo + name, greyscale until hover |
| PricingCard | Name, who it is for, price, list, one button |
| Testimonial | Renders only verified quotes with a source (store review link or written permission). Empty list shows a "Become a beta tester" card instead |
| FooterLegal | Same on every page: legal row, not-advice paragraph, not-affiliated paragraph |

**Hero.** One headline, one subhead, one primary button ("Add to Chrome"), a small text link "Also on Firefox", a one-line trust note, and the product picture.

**Product picture.** Keep the HTML/SVG chart mock (fictional members, made-up prices) instead of a PNG screenshot. See 9.2.

**Mobile.** The product is desktop-only, but the site must work at 320px wide: single column, no sideways scroll, 44px touch targets.

**Logo.** The mark in `brand/` (from PR #16): a disclosure strip with a rising teal signal line, on a slate tile at small sizes, plus the "Capitol Tape" wordmark. Brand colours slate `#172536`, off-white `#F7F8F6`, muted teal `#4D9A88`. The site build copies the favicon files from `brand/`, so the logo lives in one place. No dome, no flag, no red-and-blue.

---

## 5. Backend schema

Only one table is new. Existing tables (`trades`, `accounts`, influence tables) do not change.

```sql
-- worker/migrations/0005_waitlist.sql
CREATE TABLE waitlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,             -- lower-cased, trimmed
  list        TEXT NOT NULL,             -- 'mobile' | 'desk' | 'beta'
  ref_code    TEXT NOT NULL UNIQUE,      -- 8 chars, this person's own share code
  referred_by TEXT,                      -- ref_code of whoever sent them, if any
  created_at  INTEGER NOT NULL,          -- unix seconds
  UNIQUE (email, list)
);
CREATE INDEX waitlist_referred_by ON waitlist (referred_by);
```

**Route.** `POST /waitlist` with `{ email, list, ref? }`.
- Validates email shape and list name; ignores an unknown `ref`.
- Same email + list twice returns the existing share code (no error, no duplicate).
- Returns `{ ok: true, refCode, referrals }`.
- CORS: only the site origin. Rate limit by IP using the existing pattern.

**Privacy.** Email is used only to tell that person when the list opens. The privacy page says so; one email unsubscribes them.

---

## 6. Implementation plan (phases)

**Phase A — foundations (PR 1, PR 2).** Spec; move the site to `src/` + `public/` + build; deploy from `site/dist`. Done when `npm run build:site` writes the same pages as today and all site tests pass against `dist`.

**Phase B — look and trust (PR 3, PR 4).** New tokens and components; one-CTA hero; signal box with icons; legal pages; trust strip; repository trust docs. Done when every page shares one header and one footer, the footer legal row has no `#` links, and axe finds no violations.

**Phase C — safety nets (PR 5).** Security headers; CI builds the site, checks every internal link, runs axe on every page and Lighthouse on three. Done when CI fails on a broken link or an accessibility violation.

**Phase D — growth (PR 6, PR 7).** Guides, sitemap, social card, waitlist and referral codes; extension level icons. Done when the waitlist works end to end against a local Worker and the sitemap lists every page.

**Phase E — owner tasks (not code).** See 10.

---

## 7. Legal and compliance review

This is a checklist for the owner and a lawyer. It is not legal advice.

### 7.1 Commercial use of disclosure reports (highest risk)

The Ethics in Government Act, 5 U.S.C. § 13107(c), makes it unlawful to obtain or use a financial disclosure report "for any commercial purpose, other than by news and communications media for dissemination to the general public." The House Clerk's disclosure site repeats this warning. The Attorney General can sue; the civil penalty is capped at an inflation-adjusted amount (OGE currently lists $25,132).

Capitol Tape charges $8/month for Pro. Pro sells watchlist size and alerts, not the data, and the data comes through Bargo, but a court could still see the paid product as a commercial use of the reports. This was already a listed launch blocker in the 2026-10-13 delta. It stays the first item:

- [ ] Written legal opinion on whether Pro (and the Desk tier) is a commercial use under § 13107(c), and whether the news-media exception could apply.
- [ ] Written confirmation from Bargo of the terms of commercial use of its API.
- [ ] Until both are in hand, keep the site copy saying "public disclosure data" and "information only", and do not run paid ads for Pro.

### 7.2 Platform terms of service

The extension reads the ticker from the page address or title and draws its own panel on the page. It does not click, submit, log in, scrape prices, or call the platform's APIs. That is the strongest position for a read-only extension, but each platform's terms still need a line-by-line read. TradingView's terms license its market data for display only and bar non-display use; several third-party TradingView extensions put the compliance duty on their users.

| Platform | Check | Status |
|---|---|---|
| TradingView | Terms of Use §3 (prohibited uses, non-display data), trademark use in store screenshots | Owner to read and record |
| Robinhood | Website terms: automated access, overlays, trademarks | Owner to read and record |
| Webull | Terms of use: same questions | Owner to read and record |
| Charles Schwab | Website terms of use: automated means, framing, trademarks | Owner to read and record |

`docs/platform-terms-review.md` (PR 4) has the template: clause, quote, our behaviour, risk, action. Store screenshots that show TradingView's interface and the NVIDIA logo should be replaced or cleared before submission.

### 7.3 Data accuracy and liability

Expand the disclaimer (PR 4, `data.html` and Terms): the data is third-party public data provided "as is"; we are not responsible for errors, omissions, late or missing filings, or Bargo outages; amounts are ranges; the trade date can be 45+ days before the filing; always check the official House and Senate portals.

### 7.4 "Not financial advice"

Already on the site and in the panel. PR 4 makes it a fixed part of `FooterLegal` on every page and a section of the Terms. PR 6 keeps it in every guide.

### 7.5 Missing pages

Terms of Service did not exist; Privacy did (the review missed it because the footer "Terms" link was `#`). PR 4 adds Terms, Data & Disclaimers, Security, FAQ and Changelog, and replaces every `#` footer link.

### 7.6 Fake testimonials

The three home-page quotes are invented. Even with the "illustrative" note, made-up endorsements can break FTC rules on endorsements and fake reviews. PR 6 removes them and adds a component that shows only verified quotes.

---

## 8. Marketing plan

**Channels, in order.**
1. Store listings (Chrome, Firefox): the strongest channel. Screenshots without third-party UI, the not-advice line visible.
2. Communities: r/TradingView, r/stocks, r/investing (check each subreddit's self-promotion rules), TradingView ideas/scripts community, finance Discords. Post as the maker, link the guide page rather than the home page, answer questions.
3. Product Hunt: launch after 10 verified reviews.
4. Niche newsletters: disclosure-tracking and retail-trading newsletters; offer the Desk preview.

**SEO pages (PR 6).**
- "How to see congressional trades on TradingView"
- "STOCK Act disclosures explained"
- "Congress trade data API" (points to Bargo and explains what Capitol Tape does and does not offer)

**Social proof.** Collect quotes only from real beta users with written permission, or quote public store reviews with a link. Show store rating once there are 10 or more ratings.

**Referral and waitlist.** See 9.3 for why the reward is not "extra lookups".

**Copy rules** (also in `docs/brand-voice.md`, PR 3):

| Say | Don't say |
|---|---|
| public disclosure data | insider data, secret trades |
| information only | signals to trade on, alpha, edge |
| members disclosed a trade | politicians are buying |
| Quiet / Watch / Hot shows filing activity | Hot means buy |
| delayed up to 45 days by law | real-time |

---

## 9. Where this plan differs from the review notes

**9.1 The extension stays at the repository root.** The notes asked for `/src` for the app. The extension uses WXT, whose folders (`entrypoints/`, `components/`, `lib/`, `public/`) are the convention its tools and 32 test files expect. Moving it buys nothing a reader can see and risks breaking the build. `/src`, `/public` and `/legal` are applied to the website instead, where they help (`site/src`, `site/public`, `site/src/legal`). `/docs` already exists.

**9.2 No PNG screenshot in the hero.** The only real screenshots show TradingView's interface, the NVIDIA logo and real members' names. On a marketing page that adds trademark and fairness questions. The HTML chart mock is sharp at every size, loads instantly, and uses fictional members. Record a GIF later on a neutral chart if wanted.

**9.3 Referral reward is not extra lookups.** Lookups are limited by Bargo per network, not by Capitol Tape, so there is nothing to give. The waitlist stores referral codes and counts so a reward can be chosen later (waitlist priority, an early Desk seat, or a Pro month once ExtensionPay coupons are confirmed). Promising "extra lookups" now would be a promise we cannot keep.

**9.4 Signal colours.** The notes said "one accent colour". We read that as one accent *set* (the traffic-light trio) used only for signal states, with buy/sell green and red allowed inside trade data only. Everything else is the logo slate and white.

---

## 10. Owner tasks before launch

- [ ] 7.1: legal opinion on § 13107(c) and Bargo's written commercial terms.
- [ ] 7.2: fill `docs/platform-terms-review.md` for all four platforms.
- [ ] A lawyer reads `terms.html`, `privacy.html` and `data.html`.
- [ ] Set GitHub repository variables: `SITE_CONTACT_EMAIL`, then `SITE_CHROME_URL`, `SITE_FIREFOX_URL` once listed, `SITE_AUTH_BASE` once the Worker is live.
- [ ] Apply migration `0005_waitlist.sql` to D1 and deploy the Worker.
- [ ] Replace store screenshots that show third-party interfaces.
- [ ] Real social links (or remove the icons).
- [ ] Collect beta testimonials with written permission.

## Sources

- 5 U.S.C. § 13107: https://www.law.cornell.edu/uscode/text/5/13107
- OGE note on § 13107(c) and the current penalty: https://www.oge.gov/web/OGE.nsf/Officials%20Individual%20Disclosures%20Search%20Collection
- House Clerk disclosure search (shows the commercial-use warning): https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch
- TradingView terms and policies: https://www.tradingview.com/policies/
