# Design: Capitol Tape becomes a publication with a free chart companion

Date: 2026-10-18 · Status: approved in brainstorming, awaiting spec review · Not legal advice. Items marked ⚖️ need a lawyer.

Builds on `congree-research-spec.md` (the 5 U.S.C. 13107 analysis) and `docs/2026-10-13-prd-delta.md` (version 1.1.0).

## 1. Why the direction changes

5 U.S.C. 13107(c) bans using congressional disclosure reports for a commercial purpose, except by news and communications media for dissemination to the general public. Today the paid tier (Pro, $8/month) sells an unlimited watchlist and new-filing alerts: it charges for the reports. The new direction:

1. **Move the paid value away from the trade records.** Everything trade-related becomes free. Paid value later comes from the policy layer (bills, executive orders, lobbying) and convenience tools.
2. **Become a publication.** Original weekly reporting, analysis and explainers, with editorial judgment, where filings are supporting material inside articles.
3. **Cite official sources.** Every trade fact links to the House Clerk or Senate eFD record.

## 2. Roadmap (one spec each)

| Spec | Scope | Status |
|---|---|---|
| **This spec** | Re-tier the extension (trade features free, Pro paused) and rebuild the site as a publication with a free newsletter | This document |
| Spec 2 | Policy Pro in the extension: Senate LDA lobbying data next to bills and executive orders, policy-event alerts, export, layouts | Later |
| Spec 3 | Paid publication tier (premium analysis behind billing) | After a lawyer clears the news-media exception ⚖️ |

## 3. Extension re-tier (version 1.2.0)

### 3.1 Free for everyone
- Trade panel unchanged: member, party, date, type, amount range, from Bargo.
- Watchlist has no limit. Remove the `FREE_WATCHLIST_LIMIT` check in `lib/watchlist.ts` and the limit message in `components/WatchButton.tsx` and `entrypoints/popup/Popup.tsx`.
- New-filing browser notifications go to everyone. Remove the `isPro()` check in `lib/alerts.ts`.

### 3.2 Official record link on every trade row
- Each row shows "Official record ↗", opening in a new tab with `rel="noopener noreferrer"`.
- Target: `CongressTrade.sourceUrl` (from Bargo's `filing_portal`). The first plan task checks what `filing_portal` contains in live responses (a filing PDF, or a portal home page) and records it.
- Fallback when `sourceUrl` is null or is only a portal home page: the chamber's search page, labelled "Search official records".
  - House: `https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch`
  - Senate: `https://efdsearch.senate.gov/search/`
- A trade row never renders without one of these two links.

### 3.3 Pro paused
- Plan tab: remove "Upgrade to Pro" and "Already paid? Log in". Show: "Policy Pro is coming: alerts on bills and executive orders for your sectors." with a "Join the waitlist" link to `/extension/#waitlist` on the site.
- If the cached status says paid, also show "You have an active subscription. Manage subscription" so nobody is stranded. That button keeps calling ExtensionPay's existing manage page.
- `lib/extpay.ts`, `lib/pro.ts` and the ExtensionPay setup stay in place, unused for gating, for spec 2.
- The Free/Pro badge in the popup header is removed. The `checkedAt` refresh logic stays, because the "Manage subscription" state depends on it.

### 3.4 No money asks next to trade data
13107(c)(1)(D) bans using the reports to solicit money.
- The panel, the pop-out window and the browser notifications carry no upgrade, pricing, payment, donation, waitlist or newsletter text or links.
- A free newsletter link may appear only in the popup's Plan tab and on the site.

### 3.5 Copy, constants, release note
- Delete `PRO_PRICE_MONTHLY` and `FREE_WATCHLIST_LIMIT`. Spec 2 brings its own pricing constants.
- `README.md`, `CHROMEWEBSTORE.md` and the store listing drop "$8/month", the 3-ticker limit and "Upgrade to Pro". The store's single-purpose and data-use answers do not change, because no new data is collected.
- `RELEASE_NOTES['1.2.0']` in `lib/update.ts`: "Watchlist and new-filing alerts are now free for everyone. Each trade links to its official record."
- Unchanged: disclaimer text, Bargo as the panel's data source, keyless limit message, edge tab, pop-out, update gate.

## 4. Publication site

### 4.1 Build
- `site/` becomes an Astro project with its own `package.json` (the extension's dependencies stay separate). Static output only, no server rendering.
- `.github/workflows/deploy-site.yml` adds `npm ci` and `npm run build` in `site/` and deploys `site/dist` to the same Cloudflare Pages project, `capitol-tape`. The path filter stays `site/**`.
- Current CSS tokens and markup move into an Astro layout, so the look stays the same.

### 4.2 Pages

| Route | Contents |
|---|---|
| `/` | Masthead: "Capitol Tape: reporting on what Congress trades and what it passes." Lead story (latest weekly), the 6 most recent articles, newsletter signup, and a short "Our free chart companion" block linking to `/extension/` |
| `/articles/` | All published articles, newest first, filterable by kind |
| `/articles/[slug]/` | Byline, date, kind, body, sources list, corrections list, disclosure box (AI assistance, author holdings, not-advice line), newsletter signup |
| `/weekly/` | Weekly issues only |
| `/extension/` | Today's landing content: features, how it works, broker links, the 535 members / 90 days / 4 platforms / 0 permissions stats, FAQ. The pricing grid becomes "Free" plus a `#waitlist` section for Policy Pro (Buttondown tag `policy-pro-waitlist`). The Desk tier goes. The Pro FAQ entry becomes "Is there a paid plan?" |
| `/about/` | Mission, who runs it, how it is funded. No trade data on this page |
| `/standards/` | Editorial standards (5.3) |
| `/privacy/` | Today's `privacy.html`, content unchanged, plus one line on Buttondown handling newsletter emails |
| `/rss.xml` | Published articles, full summaries, links |

Removed from the site: the three made-up testimonials (a publication cannot carry invented quotes), the $8/month pricing grid, the Desk tier.

### 4.3 Article content model
Markdown files in `site/src/content/articles/`, named `YYYY-MM-DD-slug.md`. Frontmatter is validated by an Astro content collection schema. The build fails on any violation.

| Field | Type | Rule |
|---|---|---|
| `title` | string | required |
| `kind` | `weekly` \| `analysis` \| `explainer` | required |
| `date` | date | required; publication date |
| `author` | string | required |
| `summary` | string | required, at most 280 characters; used on listings, RSS, meta description |
| `sources` | `{ label: string, url: string }[]` | at least 1; each `url` is an absolute https URL |
| `aiAssisted` | boolean | required |
| `authorHoldings` | `"none"` or string[] of tickers | required |
| `corrections` | `{ date: date, note: string }[]` | optional, defaults to empty |
| `draft` | boolean | optional, defaults to false; drafts are excluded from production builds, listings and RSS |

Data inside articles: small tables and quotes from individual filings, each linked to its official record. No bulk tables and no downloadable datasets.

### 4.4 Newsletter
- Buttondown, free tier. An embedded signup form (plain HTML form POST to Buttondown, no third-party script) on `/`, `/articles/[slug]/` and `/extension/#waitlist` (the waitlist form adds the `policy-pro-waitlist` tag).
- Buttondown sends each new weekly from `/rss.xml` (its RSS-to-email feature), or by hand from the Buttondown editor.
- Free only in this spec. The paid tier is spec 3.

## 5. Editorial workflow

### 5.1 Weekly brief
`npm run brief` (root `package.json`, script in `scripts/weekly-brief.mjs`) writes `briefs/YYYY-Www.md` (ISO week). Briefs are committed as part of the editorial record.

| Section | Source | Notes |
|---|---|---|
| House filings | House Clerk yearly index `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip`, the XML inside, rows with `FilingType` = `P` and `FilingDate` in the last 7 days | Each entry: member, state/district, filing date, PDF link `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{DocID}.pdf`. Tickers are in the PDFs; the editor reads them |
| Senate filings | A link to eFD search for the week's date range | eFD requires a person to accept its terms and blocks automated use, so this is manual |
| Bills | Congress.gov API through the parsers in `worker/src/bills.ts` | Bills whose latest action in the week is passed a chamber, sent to the President, became law or vetoed. Key from local `.env` `CONGRESS_API_KEY` |
| Executive orders | Federal Register API through `worker/src/orders.ts` | Signed in the week; no key |
| Spot checks | Bargo, only with `--tickers NVDA,LMT` | Within the free daily limit |

The first plan task fetches the live Clerk index once and records its real field names and date format; the parser and fixtures follow what it finds.

Each section fails on its own: on error it writes "{Source} unavailable: {reason}" and the others still run. Missing `CONGRESS_API_KEY` skips the bills section with a note. The script exits non-zero only when every section fails.

### 5.2 Drafting and publishing
1. Monday: `npm run brief`.
2. In Claude Code: "draft the weekly from `briefs/2026-W43.md`". Claude writes `site/src/content/articles/YYYY-MM-DD-weekly.md` with `draft: true` and `aiAssisted: true`.
3. The editor rewrites for judgment and angle, checks every figure against the official PDF, fills `authorHoldings`, and sets `draft: false`.
4. Open a PR; CI builds the site. Merging to `master` deploys. Buttondown picks up the RSS item.

`site/EDITING.md` holds this workflow and the pre-publish checklist: every trade fact linked to an official record; every figure checked against the PDF; no buy/sell language; holdings filled in; no trades in covered tickers since the first draft.

### 5.3 `/standards/` page
- **Sourcing.** Every trade fact links to the official House or Senate record. Bargo is a lookup aid and is never the cited source.
- **AI assistance.** Pieces drafted with AI say so. A human editor checks every fact and decides what runs.
- **Corrections.** Corrections are appended with a date. No silent edits.
- **Conflicts.** The author's holdings are disclosed on every article. No trading in a covered ticker from the first draft until 48 hours after publication.
- **Not advice.** Impersonal, on a regular schedule, the same for every reader, no buy or sell calls (the publisher exclusion in *Lowe v. SEC*, 472 U.S. 181 (1985)). No backtested returns and no claims that following Congress makes money (FTC Act section 5).
- **Independence.** No paid placement, no sponsored content, no affiliate links.

## 6. Tests

| Area | File | Check |
|---|---|---|
| Watchlist | `tests/watchlist.test.ts` | Adding a 4th, 10th ticker succeeds with no Pro status |
| Alerts | `tests/alerts.test.ts` | A new filing on a watched ticker notifies with no Pro status |
| Plan tab | `tests/popup-plan.test.tsx` | Paused state: waitlist link present, no "Upgrade" button; with cached paid status, "Manage subscription" present |
| Official link | `tests/trade-row.test.tsx` | Row with `sourceUrl` links to it; row with null `sourceUrl` links to the chamber search page for its chamber |
| No money asks | `tests/no-asks.test.tsx` | Rendered panel and pop-out contain no text or links matching `/upgrade\|\bpro\b\|donat\|subscribe\|pricing\|waitlist\|newsletter/i` |
| Parity (flipped) | `tests/parity.test.ts` | `README.md`, `CHROMEWEBSTORE.md` and `site/src/**` contain no `$8/month`, no "3 tickers", no "Upgrade to Pro"; site still has the optional-key wording and `bargo.ai/connect` |
| Content schema | `site/tests/schema.test.ts` | An article fixture without `sources` fails validation; a valid one passes |
| Drafts | `site/tests/build.test.ts` | After build, a `draft: true` fixture slug is absent from `dist/` and `rss.xml` |
| Language guard | `site/tests/build.test.ts` | No file in `dist/**/*.html` contains "buy signal", "beat the market", "donate", "$8/month" |
| Accessibility | `site/tests/a11y.test.ts` | axe (WCAG 2.2 AA tags) on built `/`, one article, `/standards/`, `/extension/` has no violations |
| Brief | `tests/weekly-brief.test.ts` | Fixture Clerk XML gives the right PTR entries and PDF URLs for the date window; a failing source writes the "unavailable" line and the rest of the brief |
| CI | `.github/workflows/ci.yml` | Adds `npm ci`, `npm run check`, `npm run build`, `npm test` in `site/` |

Manual, once: load the 1.2.0 build, confirm official links open the right record on two House and two Senate trades; submit the newsletter form and the waitlist form and see both in Buttondown.

## 7. Before promoting (not code)
1. ⚖️ Lawyer's opinion: does a free publication with editorial content, plus a free extension, fit the news-media exception in 13107(c)? Does showing Bargo rows in the free extension count as commercial use while no product is sold?
2. Bargo's written permission to display its data in the extension (a contract question, separate from the statute).
3. Buttondown account; replace `hello@example.com` and `#` social links with real ones.
4. The author's holdings disclosure for the first issues.

## 8. Out of scope
Policy Pro, Senate LDA lobbying data, export, policy alerts, layouts (spec 2). Paid newsletter tier (spec 3). FEC data. Aggregate statistics. A nonprofit entity. Automated Senate eFD ingestion. Site search, comments, user accounts. Changes to the extension's disclaimer text.
