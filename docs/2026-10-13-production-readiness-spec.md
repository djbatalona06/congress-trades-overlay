---
title: Capitol Tape — Production Readiness Spec
type: project
created: 2026-10-13
status: draft
summary: What is left to ship Capitol Tape to the Chrome Web Store at production quality, covering the header menu, Pro/auth flow, paywall parity and WCAG AAA at low cost.
related: ["docs/2026-10-07-congress-trades-overlay-spec.md"]
---

# Capitol Tape — Production Readiness Spec

Builds on `docs/2026-10-07-congress-trades-overlay-spec.md`. That spec stays the source for architecture, data schema and Bargo facts. This one covers only the gap to production.

## About me

> **To fill in:** replace the bracketed text with your own words. Keep it to a few sentences. Don't include anything you don't want public, since this spec is in a repository and may later be shared.

- **Who I am:** [your name or handle, and what you do]
- **Why I built this:** [the moment or frustration that started Capitol Tape]
- **How it was built:** [who wrote the code and how: e.g. "I designed it and used AI coding tools to write most of the code"]
- **What I want from it:** [e.g. "a useful free tool for everyday traders; a small paid tier that pays for the data"]
- **How to reach me:** [support or contact email, or "see the site's Contact link"]

## 0. Interpretations

Where the request was ambiguous, this is the reading used. Change any of these and the matching section changes.

| Request | Reading |
|---|---|
| "Google Play store" | **Chrome Web Store.** Google Play does not host Chrome extensions. Firefox AMO is a second store with the same code. |
| "Matches the pay" | **Paywall parity.** The price, the free limit and the Pro features say the same thing in the store listing, the README, the popup and the code. |
| "Updating existing auth" | **The ExtensionPay account flow:** Pro status, login, upgrade and refresh in the popup. No new auth provider. |
| "Header menu for traveling" | **A top tab bar in the popup** that moves between Watchlist, Plan and Lookups. |
| "AAA with a low cost" | **WCAG 2.2 AA required everywhere. AAA applied where it costs only CSS or a test.** Items that need redesign are listed as deferred. |

## 1. PRD delta

- **Header menu:** the popup gets a top bar with the brand, the Free/Pro badge and three tabs. Each tab shows one section. Only one section is visible at a time, so the 340px popup stops scrolling through everything.
- **Account:** the Plan tab shows real status, when it was last confirmed, and one action for each state. A failed check says so, instead of failing silently.
- **Paywall parity:** price, free limit and Pro features come from one set of constants. A test fails if the store listing drifts from them.
- **Accessibility:** WCAG 2.2 AA for the whole extension, AAA for contrast and target size. Keyboard-only use works in the popup and the panel.
- **Broker links on the site:** a row of links to each broker's company website (TradingView, Robinhood, Webull, Charles Schwab, and Interactive Brokers / IBKR), so visitors can open their existing broker or start a new account. Only the first four are supported by the extension (see 3.6).
- **Out of scope:** new analytics (it would change the store's data-use disclosure), a logout button (confirm ExtensionPay supports it before adding one), Safari, i18n, rendering Worker bill data in the panel, and any change to the disclaimer text.

## 2. Current gaps (checked in code)

| # | Gap | Where | Why it matters |
|---|---|---|---|
| G1 | Popup is one long scroll page; no navigation | `entrypoints/popup/Popup.tsx` | The requested header menu does not exist yet |
| G2 | Login failure is silent: `refreshPro()` falls back to cache and logs a warning | `lib/extpay.ts` | A paying user who is offline sees "Free" with no reason |
| G3 | Cached Pro status has no "last checked" time | `lib/pro.ts`, popup | The user cannot tell whether the badge is current |
| G4 | "$8/month" and "3 tickers" are typed by hand in Popup, README, `CHROMEWEBSTORE.md`, `site/` | several | Price changes will drift |
| G5 | Muted text is 6.96:1 on `--bg` and 5.71:1 on `--bg-raised`; AAA needs 7:1 | `entrypoints/popup/style.css` | Fails AAA for small text |
| G6 | Control borders are 1.72:1 on the background | `--border` token | Fails the 3:1 non-text rule (WCAG 1.4.11, AA) when borders are the only edge of an input or button |
| G7 | Buttons are below 44×44 CSS px (e.g. the ghost "Remove" buttons) | popup CSS | Fails WCAG 2.5.5 (AAA) |
| G8 | No `prefers-reduced-motion` rule | both stylesheets | Motion users get the panel's transitions |
| G9 | No automated accessibility or parity check; no CI on PRs | `tests/`, `.github/workflows/` | Regressions go unnoticed |

Launch blockers that are not code (from the store checklist; unchanged): ExtensionPay id registered, Bargo permission for commercial use, legal advice on 5 U.S.C. 13107(c)(1) before promoting Pro, privacy-page contact email, `site/` published, store screenshots that show TradingView's UI (get permission or swap them), and a real Firefox run.

## 3. Technical design

Stack stays as it is: WXT 0.21, React 19, plain CSS, Vitest. New runtime cost: $0. New dev dependency: `axe-core` only, for the accessibility test (section 4.3).

### 3.1 Single source for plan facts (fixes G4)

- `lib/watchlist.ts` already exports `FREE_WATCHLIST_LIMIT`. Add `PRO_PRICE_MONTHLY = 8` next to it. No new file.
- Popup, and any code that prints the price, read from these constants.
- Markdown and HTML copy stays hand-written. A test enforces it (section 4.2).

### 3.2 Header menu (fixes G1)

- Replace the stacked sections in `Popup.tsx` with a tab bar inside `<header>`:
  - `<nav aria-label="Popup sections">` containing a `role="tablist"`.
  - Three `role="tab"` buttons: **Watchlist**, **Plan**, **Lookups**. Each has `aria-controls` and `aria-selected`.
  - One `role="tabpanel"` that renders the active section.
- Keyboard: Left/Right move focus and selection, Home/End jump to the ends, Tab leaves the tab bar. Roving `tabIndex`.
- Default tab: Watchlist. The selected tab is not saved. A tab restored from storage is a per-viewer convenience, not a need, so it is cut.
- Keep the Pro/Free badge in the header, visible on every tab.

### 3.3 Account and Pro status (fixes G2, G3)

- `lib/extpay.ts` `refreshPro()` returns a result instead of a bare boolean: `{ ok: true, paid, checkedAt }` or `{ ok: false, cachedPaid, checkedAt }`. The caller can then show the difference.
- `lib/pro.ts` already stores `checkedAt`. Use it.
- Plan tab, by state:
  - **Pro, confirmed:** "Pro is active. Last checked {time}." Button: **Manage subscription**.
  - **Free, confirmed:** Upgrade to Pro (primary) and **Already paid? Log in**.
  - **Check failed, cached Pro:** "Couldn't reach the payment server. Showing Pro from {time}." Button: **Try again**.
  - **Check failed, no cache:** "Couldn't check your plan. Check your connection and try again." Button: **Try again**.
- **Try again** calls `refreshPro()` and redraws. It does not open a page.
- Keep the existing 72 h grace period in `lib/pro.ts`. Do not shorten it.
- Logout is not part of this spec. Confirm ExtensionPay's sign-out support in its README before adding one.

### 3.4 Accessibility (fixes G5–G8)

| Item | Change | Target |
|---|---|---|
| Text contrast | Lighten `--muted` until it is at least 7:1 on both `--bg` and `--bg-raised`. Check both values in the test in 4.3. | AAA 1.4.6 |
| Control borders | Add `--control-border` at 3:1 for inputs and buttons. Keep `--border` for decorative separators. | AA 1.4.11 |
| Target size | Minimum 44×44 CSS px for every popup button, tab and the panel toggle. Use padding, not larger text. | AAA 2.5.5 |
| Focus | 2 px outline in an accent colour that is at least 3:1 against both backgrounds. | AAA 2.4.13 |
| Motion | `@media (prefers-reduced-motion: reduce)` turns off transitions and animation in both stylesheets. | AAA 2.3.3 |
| Status messages | Add-to-watchlist errors and Pro status changes go in a `role="status"` live region. | AA 4.1.3 |
| Panel controls | Keep the existing `aria-expanded` and `aria-pressed`. Add an accessible name to the close button. | AA 4.1.2 |

Contrast ratios in the table are checked by the test in section 4.3, not by eye.

### 3.6 Broker links on the site

- **Where:** `site/index.html`. A new "Already have a broker?" row after the supported-platforms strip, and the footer's Platforms list.
- **Links:** company home pages, one per broker. TradingView `tradingview.com`, Robinhood `robinhood.com`, Webull `webull.com`, Charles Schwab `schwab.com`, Interactive Brokers `interactivebrokers.com`.
- **Behaviour:** each link opens in a new tab with `rel="noopener noreferrer"` and a screen-reader note "(opens in a new tab)". No affiliate codes, tracking parameters or redirects are added.
- **Honest labelling:** the four brokers the extension supports say so. IBKR is labelled "listed for convenience only; not supported by the extension yet". Adding IBKR support means a new platform module in `lib/platforms/` and new host permissions, which is a separate task.
- **Before launch:** check each link once in a browser, since company sites change their URLs. Confirm that affiliate programmes (if you join any) are disclosed on the site; none are included now.

### 3.5 Shipping checks (fixes G9)

- One GitHub Actions workflow, `.github/workflows/ci.yml`, on pull requests: `npm ci`, `npm run compile`, `npm test`, `npm run build`, `npm run build:firefox`. Run `npm run zip` only on tags.
- Keep `deploy-site.yml` as it is.

## 4. Tests

Each item is one runnable check. No new frameworks.

1. **Tab keyboard behaviour** (`tests/popup-nav.test.tsx`, jsdom): Right moves to Plan; End goes to Lookups; the selected tab has `aria-selected="true"`; the tab panel's `aria-labelledby` points at the active tab.
2. **Parity** (`tests/parity.test.ts`): `CHROMEWEBSTORE.md`, `README.md` and `site/index.html` each contain `$${PRO_PRICE_MONTHLY}/month` and the free-limit wording. Fails with the file name when one drifts.
3. **Contrast and axe** (`tests/a11y.test.ts`):
   - Compute the WCAG contrast ratio of `--muted`, `--control-border` and the focus colour against each background. Fail below 7:1 for text, 3:1 for non-text.
   - Render the popup and run `axe-core` with `wcag2aaa` tags. Fail on violations. Known exceptions go in one array with a reason next to each.
4. **Pro state** (extend `tests/` for `refreshPro`): with the ExtPay call mocked to throw, `refreshPro()` returns `ok: false` with the cached value and time; with no cache it returns `cachedPaid: false`.
5. **Manual, once before submission:** load the unpacked build in Chromium, click through all four sites, the popup tabs with the keyboard only, and the Plan states above with ExtensionPay in test mode.

## 5. Phases

| Phase | Work | Done when |
|---|---|---|
| A | Section 3.1 constants; parity test (4.2) | Test passes; no hand-typed price in code |
| B | Header menu (3.2); keyboard test (4.1) | Three tabs work with keyboard only |
| C | Account states (3.3); Pro refresh test (4.4) | Each Plan state shows its copy; offline shows the reason |
| D | Accessibility tokens, targets, focus, motion (3.4); axe and contrast test (4.3) | axe clean at WCAG 2.2 AAA, with exceptions listed |
| E | CI workflow (3.5) | PRs run compile, test and both builds |
| F | Manual pass (4.5); store checklist (section 2 blockers) | Store submission ready |

Phases A to E are code and can be merged one at a time. Phase F needs the human blockers in section 2 first.

## 6. Deferred, with the trigger that brings each back

- **Rendering Worker bill and order data in the panel.** Trigger: the Worker is switched on for real users.
- **Persisting the selected tab.** Trigger: users ask for it.
- **Logout.** Trigger: ExtensionPay documents a sign-out call.
- **Full AAA on every colour in the panel's dark palette beyond the tokens above.** Trigger: the axe run flags a panel element that the tokens do not cover.
- **Localisation.** Trigger: a second language is planned.

## 7. Risks

- **Lighter muted text** could fail a visual design preference. The change is one token; check in the screenshots before submitting.
- **44 px targets** make the popup taller. The 340px width stays; the Watchlist list may need scrolling. Accepted.
- **axe-core** may report false positives inside Shadow DOM. Keep exceptions listed, not silenced.
- **Bargo licence and 5 U.S.C. 13107(c)(1)** remain the largest risk to the paid tier. No code change removes it.

## 8. Verification log

Not run yet. This spec was written from reading the code. Before the first phase, run `npm ci && npm test` to record the baseline. The baseline was not run in this session.
