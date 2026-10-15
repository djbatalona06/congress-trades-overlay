# Influence layer: spec and build status

## Build status (read this first)

| Phase | State |
|---|---|
| 0 Decisions and legal | **Open.** Bargo written permission, counsel on 5 U.S.C. 13107, Senate eFD terms. Nothing below ships to the store until these are answered in writing here. |
| 1 Schema | **Done.** `0002_influence.sql` (`ie_spend`, `bill_tax_flags`) and `0003_lobbying.sql` (`lobby_filing`, `lobby_issue`, `member_fec`). Bills and orders already existed from `0001`; trades stay in Bargo's cache. |
| 2 Ingest | **Code and tests done; not yet run against the real sites.** `syncMemberLinks`, `syncOutsideMoney` (every spender in a member's race, nobody picked by name) and `syncLobbying` (only issue codes the Senate's own list confirms) in `worker/src/ingest.ts`. Field names follow the official docs but are unchecked live. `npm run verify:influence` (needs `FEC_API_KEY` and network access to `api.open.fec.gov`, `lda.senate.gov`, `unitedstates.github.io`) checks them and writes `docs/influence-verification-<date>.md`. **The FEC ids and issue codes count as verified only when that report says clean.** Tax-flag ingest and the review queue are still not built. |
| 3 Read API, chips, Influence section | **Built, off by default.** `GET /v1/ticker/{T}` now includes `ie_spend`, `tax_flags` and `lobbying`. Three 0-point chips (`tax-break`, `outside-money`, `lobbying`) and an "Influence" list in the panel. A popup checkbox turns it on. |
| Lobbying chip | **Built** (0 points, off with the Influence switch). Its issue-code list is a proposal, filtered against the Senate's list at run time. |
| 4 Dual display and Bargo match badge | **Not built.** Needs the official-source trade feed from Phase 2, and Bargo's permission. |
| 5 Review queue, 6 store pass | **Not built.** Until a person reviews a tax flag (`reviewer` set), it is never sent. |

Differences from the plan, on purpose: the Influence section is a native `<details>` disclosure instead of a separate tab (keyboard and screen-reader support for free, less code); the flag is one switch (`influenceEnabled`) because the Bargo verifier does not exist yet.

---

# Original plan: "Influence" layer for Capitol Tape (congress-trades-overlay)

## Context

- You want a new feature for the extension you're building, **Capitol Tape** (`djbatalona06/congress-trades-overlay`, WXT + React, Chrome/Firefox MV3). It already shows congressional STOCK Act trades on four broker charts (TradingView, Robinhood, Webull, Schwab) and a Quiet/Watch/Hot signal box.
- The new feature adds three things: (1) what Congress **passed** that touches a stock (bills and tax breaks), (2) **outside money** tied to members (AIPAC-linked and other committees), and (3) a **dual display** that shows a politician's record from official sources next to Bargo's copy, with a match check. You said to use Bargo's data only "if Bargo is trusted and verified enough."
- **What I checked:**
  - `bargo.ai/connect` describes an **MCP server** (`POST https://www.bargo.ai/mcp`, Bearer key, free beta). Its tool list includes `get_politician_trades`, `get_insider_trades`, `get_fund_holdings`. It is not a browser extension.
  - The extension already calls Bargo's free Congress endpoint (`lib/bargo.ts`: `/free-apis/congress/v1/trades/{ticker}`, optional `X-Api-Key`). Its docs say Bargo is the **only** data source today.
  - `lib/signals.ts` already has a `policy-nearby` chip that expects `related_bills` and `exec_orders` context from the optional Worker (`worker/`, currently off).
  - The PRD delta (`docs/2026-10-13-prd-delta.md`) lists open launch blockers: Bargo's commercial-use permission, and counsel's view on 5 U.S.C. 13107(c)(1), which limits commercial use of disclosure reports.
- **Not doing:** reverse-engineering Bargo's private backend or app. That is their proprietary system, and it conflicts with their terms. The plan uses their documented public endpoints only, and only with written permission for paid use. The `rea` repo is a reverse-engineering toolkit unrelated to this data, so I did not use it.

## Three ideas for adding the data (pick one)

| | **Idea 1: Direct-to-source in the extension** | **Idea 2: Worker-backed index (recommended spine)** | **Idea 3: Bargo as verifier (dual display first)** |
|---|---|---|---|
| How it works | The extension calls public APIs itself: Congress.gov (bills), openFEC (outside money), Senate LDA (lobbying), Federal Register (orders). Results cache in `chrome.storage`. | A nightly ingest job (Cloudflare Worker + D1, using the existing `worker/` scaffold) pulls the same sources, normalizes them, and the extension calls one endpoint. | Keep Bargo's trade feed, add a second official-source feed, and show both side by side with a Match / Differs badge. |
| User friction | High: needs the user's own API keys, which breaks "no key needed." | Low: users need no keys. | Low, but depends on Bargo's limits and license. |
| Parsing burden | Heavy in the browser (House/Senate PDF forms, bill XML). | Heavy, but done once, server-side, with tests. | Light: compares two trade lists. |
| Licence risk | Lowest for Bargo, still 13107 for trade data. | Same 13107 issue; needs counsel before Pro. | Highest: depends on Bargo's written permission. |
| Cost | $0 | Small Cloudflare cost; store disclosure update | $0 |
| Fit with existing code | Medium | High: `policy-nearby` already expects this shape | High: `lib/bargo.ts` already exists |

**Recommendation:** Idea 2 for bills, tax breaks, and outside money, plus Idea 3 as the verification layer. Idea 3's badge only switches on when Bargo's written permission is in hand. Idea 1 stays as a fallback for power users who bring their own keys.

## Recommended build (Idea 2 + Idea 3)

### Data model (Worker D1)
- `member` (id, name, party, chamber, state, committees[])
- `trade` (id, member_id, ticker, type, amount_range, trade_date, filed_date, source_url, source_hash, retrieved_at)
- `bill` (congress, number, title, latest_action_date, policy_area, summary_url, text_url)
- `bill_tax_flag` (bill_id, section_cite, sector_tags[], flagged_by: "rule" | "human", reviewer)
- `exec_order` (number, signing_date, title, url) from the Federal Register API
- `ie_spend` (committee_id, committee_name, candidate_id, support_or_oppose, amount, date, fec_url)
- `lobby_filing` (registrant, client, issue_codes[], amount, period, lda_url)
- `member_link` (member_id, committee_id, relation: "donor-candidate" | "same-race" | "committee-member")

Every row keeps `source_url` and `retrieved_at`. Nothing is shown without a link back to the filing.

### Ingest (Worker cron, nightly)
1. **Trades:** House Clerk and Senate eFD disclosures. Check the Senate eFD terms first (not verified yet). Parse PTR forms; flag scanned PDFs for review instead of guessing.
2. **Bills:** Congress.gov API. Tax-break flag = rule match on tax-code citations and terms ("credit", "deduction", "exclusion", "Internal Revenue Code") **plus** a human review queue before it shows in the UI.
3. **Outside money:** openFEC independent expenditures for pro-Israel committees (AIPAC-affiliated super PAC, United Democracy Project; AIPAC's PAC; DMFI) **and** every other top outside spender in the same races, so no single group is singled out. Committee IDs are looked up on FEC, not guessed.
4. **Lobbying:** Senate LDA filings, by issue code, for sectors that match tickers.
5. **Bargo (verifier only):** `lib/bargo.ts`-style fetch of the same trades, compared to `trade` rows by member + ticker + trade date.

### Extension UI (the feature)
- **New "Influence" tab** in the panel (after the Trades list), so the chart stays clear (matches the edge-tab work in PRD 3.7).
- **Ticker chips (0 points first):** "Tax break passed in this sector", "Outside money in this race", "Lobbying on this issue". Start at zero points so Quiet/Watch/Hot does not change until reviewed.
- **Politician card, dual display:** two columns, *Official record* (filing link, date, amount range) and *Bargo* (same fields). A row shows **Match** or **Differs** with the field name. Hidden when Bargo permission is off.
- **Neutral wording:** the same fields for every outside group. Spending shows what was reported. It says nothing about intent, votes, or outcomes. Every card links to the FEC or LDA filing. The "Not advice" line stays.

## Critical files
- `lib/signals.ts`: add the three new chips as 0-point informational chips; leave scoring alone.
- `lib/types.ts`: new types for `Bill`, `TaxFlag`, `IeSpend`, `LobbyFiling`, `DualRecord`.
- `lib/bargo.ts`: reuse for the verifier; no new endpoints.
- `lib/settings.ts`: feature flags `influenceTab` and `bargoVerifier` (default off).
- `entrypoints/overlay.content/` and `entrypoints/panel/`: the Influence tab.
- `worker/src/`: ingest jobs and the read API. `worker/migrations/` for the D1 schema.
- `wxt.config.ts`: add the Worker origin host permission only when `WXT_USE_WORKER=true` (already wired).
- `docs/`: new spec file and a plain-language summary.

## Phases
| Phase | Work | Done when |
|---|---|---|
| 0 | Decisions and legal: Bargo written permission; counsel on 13107; Senate eFD terms; pick idea | Written answers saved in `docs/` |
| 1 | Schema and fixtures (sample filings, one bill, one IE report, one LDA filing) | Migrations apply; fixtures load |
| 2 | Ingest for each source, with tests on fixtures and source-hash checks | Nightly run writes rows; re-run is idempotent |
| 3 | Read API + ticker chips (0 points) + Influence tab | Chips show with links; no change to Quiet/Watch/Hot |
| 4 | Dual display with Bargo verifier, behind flag | Match / Differs shows; off by default |
| 5 | Review queue for tax flags; accessibility and parity tests | Queue works; axe clean |
| 6 | Manual pass in Chromium and Firefox; store copy update | Store checklist done |

## Verification
- `npm test` (Vitest): unit tests for each ingest parser and for the new chips, using fixtures. Add `tests/influence.test.ts` and `tests/bargo-verifier.test.ts`.
- `npm run compile` and both builds (`npm run build`, `npm run build:firefox`).
- Spot-check: pick 20 random filings and check each row against its source page. Record the agreement rate in the spec.
- Neutrality check: for each outside-money card, confirm the same fields exist for every group shown.
- Manual: load the unpacked build, open TradingView and Robinhood, confirm the Influence tab and the chips, and confirm the chart is not covered.

## Notes for execution
- Save the final spec to `Downloads/AI projects/` as well as `docs/`, per your preference.
- PR descriptions: plain language a child could follow. **No Claude attribution, session ID, co-author line, or footer** in commits or PRs, per your preferences.
- Each phase ends with one plain-English "try it yourself" step so you can learn the code as it lands.

## Open items I could not verify from here
- Senate eFD terms on automated access.
- Current OpenSecrets API status (search results were inconclusive).
- Exact FEC committee IDs and LDA API endpoints (confirm on the official sites).
- Bargo's permission for commercial use and its real daily-limit reset (both are still open in `docs/bargo-and-this-project.md`).
