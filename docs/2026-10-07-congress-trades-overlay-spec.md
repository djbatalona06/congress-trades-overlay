---
title: Congress Trades Overlay — Spec
type: project
tags: [extension, trading, congress-trades, wxt]
created: 2026-10-07
updated: 2026-10-07
status: growing
summary: Corrected build spec for the Congress Trades Overlay browser extension (Chrome + Firefox), replacing the mechanics of the original 8-document package
related: ["[[projects-map]]"]
---

# Congress Trades Overlay — Spec

Supersedes the technical parts of the "Complete Build Package (Revised)" of 2026-10-07. Business, marketing and financial sections of that package still stand.

## 1. PRD

- **Product:** a floating panel on stock pages showing recent STOCK Act congressional trade disclosures for the ticker on screen.
- **User:** retail traders on TradingView, Robinhood, Webull and Schwab.
- **Free:** panel on all four sites, 3-ticker watchlist.
- **Pro, $8/mo:** unlimited watchlist, browser notification when a watched ticker gets a new disclosure.
- **Out of scope for v1:** history older than Bargo's 90 days, Safari, placing trades, any brokerage account access, a backend.
- **Success:** per the package's metrics and kill rule (Appendix D).

## 2. TRD

| Area | Choice |
|---|---|
| Framework | WXT 0.21, one codebase → Chrome MV3 and Firefox MV3 |
| UI | React 19, plain CSS, Shadow DOM panel |
| Tests | Vitest + WXT fake-browser, jsdom for DOM tests |
| Data | Bargo Congress Trades API, called from each user's browser |
| Payments | ExtensionPay (`extpay`), id `congress-trades-overlay` |
| Backend | None by default. Optional Cloudflare Worker in `worker/`, off unless the build sets `WXT_USE_WORKER=true` (section 8) |

**Bargo facts (verified live):** `GET https://www.bargo.ai/free-apis/congress/v1/trades/{ticker}?limit=`. Keyless: 30 requests and 100 rows per day per IP. Free key: 100 requests, 1,000 rows. Last 3 months only. No party field, no per-filing link, no id. The request-remaining header counts the current call; the rows-remaining header does not; both can lag.

**Permissions:** `storage`, `alarms`, `notifications`; host `https://www.bargo.ai/*` (plus `https://extensionpay.com/*` on Firefox). Broker sites appear only as content-script matches.

**Commands:** `npm run build`, `npm run build:firefox`, `npm run zip`, `npm run zip:firefox`, `npm test`, `npm run compile`, `npm run party-map`, `node scripts/build-icons.mjs`.

## 3. App flow

1. Content script loads on the four hosts and detects the symbol (`lib/platforms`). It re-checks on URL change and on `<head>` changes, because these sites switch symbol without a page load.
2. `lib/ticker.ts` keeps US equities only and maps FINRA corporate bonds to the issuer (`FINRA:AAPL4242667` → `AAPL`).
3. The content script asks the background for trades. Background: fresh cache → return; else budget check → Bargo → cache → return.
4. Panel states: hidden (no trades, error, unsupported page), collapsed, expanded, limit reached, saved results.
5. Popup: watchlist, plan and upgrade, lookups left today, optional Bargo key.
6. Hourly alarm (Pro): check one watchlist ticker in rotation; notify on ids not seen before. A ticker's first check only sets its baseline.

## 4. UI/UX

Dark panel, fixed bottom-right, 320px collapsed / 380px expanded, px units. Collapsed: `Congress Trades: NVDA (5 recent)` with `Data via Bargo` directly beneath (Bargo's terms require the credit on first view). Expanded: member, party badge, chamber and seat, Buy/Sell, amount range, filed and traded dates, filing-portal link, watch button, disclaimer. A close button hides it until the symbol changes.

## 5. Schema (browser `storage.local`; no database)

| Key | Value |
|---|---|
| `cache:<TICKER>` | `{ fetchedAt, trades[] }`, fresh 6 h, pruned after 7 days |
| `budget` | `{ day, requestsLimit, requestsRemaining, rowsLimit, rowsRemaining, updatedAt }` |
| `watchlist` | `[{ ticker, addedAt, platform }]` |
| `pro` | `{ paid, checkedAt }`, trusted 72 h after last successful check |
| `alertCursor`, `alertSeen` | rotation index; seen trade ids per ticker (max 50) |
| `bargoApiKey`, `overlayExpanded` | user's own key; last panel state |

ExtensionPay also stores its own user key, including in `storage.sync`.

## 6. Implementation status

| Phase | State |
|---|---|
| 1 Scaffold | Done |
| 2 Ticker detection | Done; URL shapes captured from the live sites |
| 3 Data layer | Done. Alert checks may use the first half of each day's lookups; the rest is kept for charts |
| 4 Panel | Done; checked in Chromium on all four sites and a bond page |
| 5 Popup, watchlist, party map | Done |
| 6 Alerts | Done; seen firing once for a new filing in Chromium, silent on first check and when nothing is new |
| 7 ExtensionPay | Wired; needs the registered extension id and a test-mode payment |
| 8 Store prep | Privacy page, `CHROMEWEBSTORE.md`, three 1280×800 screenshots in `store-assets/`, zips via `npm run zip`; upload pending |

Not yet run in a real Firefox (none installed on the build machine); the Firefox package builds and its manifest is correct.

## 7. Risks carried into launch

- Bargo's licence is "free, personal", silent on commercial use, and bars products competing with its data offerings. Ask Bargo before listing.
- 5 U.S.C. 13107(c)(1) restricts commercial use of disclosure reports. A disclaimer does not address it. Get legal advice before promoting the paid tier.
- Keyless budget allows roughly 20 chart lookups a day per user.
- Alerts read each ticker's 5 newest rows; a burst of more than 5 new filings between checks could hide some.
- Broker URL or DOM changes break detection; fixtures in `tests/platforms.test.ts` make the fix quick.

## 8. Worker backend (optional, behind a build flag)

Adds the legislation layer from the 2026-10-10 research spec (decisions D3 to D5) without changing the default build.

- **Where:** `worker/` (Cloudflare Worker + D1). Setup and checklist in `worker/README.md`.
- **API:** `GET /v1/ticker/{T}` returns `{ trades, related_bills, exec_orders }`.
- **Cron:** hourly Congress.gov bills (key in a Worker secret, never in the extension); executive orders from the Federal Register every 6 hours.
- **Matching:** bill policy area -> sector -> ticker, shown as "related legislation" (`worker/src/sectors.ts`).
- **Extension:** `lib/service.ts` tries the Worker first when the flag is on and falls back to Bargo on any failure. `lib/timeline.ts` merges trades, bills and orders by date. The panel does not render the legislation yet.
- **Unchanged:** the disclaimer string, the Bargo credit, and the rule that panel copy never uses "signal", "indicator" or a recommendation to buy or sell.

