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

### 1a. Findings from user testing (2026-10-13)

| # | Finding | What the code does | What needs to change |
|---|---|---|---|
| F1 | **Key conflict.** The site says "no API key" and "no sign-up", but a Bargo key is needed right after install | The key is optional (`lib/settings.ts`). Keyless requests share a daily budget per IP (`lib/bargo.ts`, HTTP 429 → "Daily Bargo limit reached"). The panel shows "(limit reached)" with no reason or next step. The popup's Lookups tab asks every user for a key | Make the limit explained and fixable in place; fix the site copy to match the real behaviour (3.9) |
| F2 | **Panel blocks the chart.** It is a dropdown box that sits over the charting terminal | `entrypoints/overlay.content/style.css`: `position: fixed; right: 16px; bottom: 16px; width: 320px` (380px expanded). It covers the lower-right of the chart | Add a dual-display layout that keeps the chart clear (3.7) |
| F3 | **No update awareness.** Nothing tells a returning user that the extension has changed | No version check or "last opened" record exists. `background.ts` only creates the alarm on install | Add an update gate that notifies the user before first use after a long gap or after an update (3.8) |

Reproduction is still needed for F1. The steps to confirm: a fresh install with no key, count the lookups until the panel shows "(limit reached)", and check whether the same happens from a second network. If the budget is shared per IP, a shared home or office network can run out quickly, which would match the report.

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
| G10 | Site says "no API key" and "no sign-up"; the first lookup can hit the keyless limit | `site/index.html` lines 493, 619; `lib/bargo.ts` | Users are misled at first use (F1) |
| G11 | Limit message has no reason and no next step | `Overlay.tsx` "(limit reached)" | Users cannot tell a bug from a limit (F1) |
| G12 | Panel is fixed over the chart; no docked or detached mode | `overlay.content/style.css` | Blocks the chart on a single screen (F2) |
| G13 | No version tracking or update notice | `entrypoints/background.ts`, `lib/` | Returning users get no sign that anything changed (F3) |

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

### 3.7 Dual-display layout that leaves the chart clear (fixes G12, F2)

Two parts, shipped together. Both are needed because a box on the page will always cover some of the chart.

- **A. Edge tab by default.** The panel collapses to a 28px tab on the right edge, vertically centred, showing the ticker and count (for example `NVDA 5`). It covers almost nothing. Expanding it opens the existing 380px panel as a drawer; it closes on Escape or the close button.
  - Existing users keep their saved `overlayExpanded` choice. Only users who have never set it get the edge tab.
- **B. Pop-out window for a second monitor.** A "Pop out" button opens `entrypoints/panel/` as a separate window (`browser.windows.create`, type `popup`, 380×720). It is a normal window, so it can sit on the second screen.
  - The pop-out reads the current ticker from `local:currentTicker`, which the content script writes on each symbol change. It uses the same `storage.watch` pattern as the watchlist, so no new messaging is needed.
  - Its size and position are saved on `pagehide` (`window.screenX/Y`, `outerWidth/Height`) and restored on the next open. If the saved position is off-screen, it opens at the default position.
  - It reuses `TradeRow` and the lookup logic from the panel. Move these into a shared module rather than copying them.
- **Why both:** A covers single-screen users. B covers dual-screen users, who are the ones who asked for it.
- **Not doing:** resizing or pushing the host page's layout. That is fragile across four broker sites and risks breaking their own UIs.
- **Choice for you to confirm:** this design ships A and B together. If you want only one, say which.

### 3.8 Update gate (fixes G13, F3)

Chrome and Firefox update the package themselves on their own schedule. The extension cannot force an update. The gate's job is to tell the user what changed, before they rely on the data.

- **Record:** `local:lastSeen` = `{ version, at }`. Written on first install, and again whenever the user taps **Continue** on the gate.
- **Show the gate when either is true:**
  1. The installed version (`browser.runtime.getManifest().version`) is different from `lastSeen.version`. This covers any update.
  2. `now - lastSeen.at` is more than 14 days (`GATE_IDLE_DAYS`). This covers "first time in a while".
- **Where:** a card at the top of the popup, shown before the first lookup of the session. It lists the version, a short "What changed" note, and the data status.
- **In the panel:** the edge tab gets a small dot until the gate is acknowledged. The panel never shows the gate card itself, so it cannot cover the chart. The dot's tooltip says "Update notes: open the Capitol Tape popup".
- **Buttons:**
  - **Continue:** writes `lastSeen`, hides the card.
  - **Check for updates:** Chrome only, calls `browser.runtime.requestUpdateCheck()`. Shows "You have the latest version" or "An update is ready. Restart Chrome to finish." Hidden on Firefox, which has no equivalent. Confirm the result values in Chromium before shipping.
- **Release notes:** a constant `RELEASE_NOTES` keyed by version, in the new `lib/update.ts`. Written by hand per release. A missing entry shows "See the store page for what changed".
- **Pure function, tested:** `shouldShowGate(now, lastSeen, currentVersion)` in `lib/update.ts`. No browser API inside it, so it is unit-tested directly (see 4.6).
- **Not in scope:** a server-side version check or push notifications. Both would need a new host permission and a new service. Trigger: the store listing is no longer enough to tell users about a change.

### 3.9 Site copy matches real behaviour (fixes G10, F1)

- `site/index.html` line 493 says "No sign-up, no API key." Change to: "No sign-up. A free Bargo key is optional and raises your daily lookups."
- `site/index.html` line 619 says "no account required." That is true, so keep it.
- Panel limit message (G11): replace "(limit reached)" with "Daily free limit reached. Resets at midnight UTC. Add a free Bargo key in the popup for more." Link to the popup's Lookups tab.
- Confirm the reset time in `lib/budget.ts` before writing "midnight UTC". Do not state a time that the code does not use.
- **Bargo key link:** every place that asks for a key links to `https://www.bargo.ai/connect`. That covers the limit message in the panel, the popup's Lookups tab, the site copy near line 562, and the README section "Do I need a key?". Use this exact URL. It is the only key link the spec uses.
- Add to the parity test (4.7): the README and site both contain `bargo.ai/connect`, and the popup's Lookups tab does too.

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
6. **Update gate** (`tests/update.test.ts`): `shouldShowGate` returns true for a changed version, true after 14 idle days, and false for the same version within 14 days. With no record at all (a first install), it returns false and the caller writes a record. Assert each case.
7. **Site copy** (add to `tests/parity.test.ts`): `site/index.html` does not contain "no API key", and does contain the optional-key wording from 3.9.
8. **Dual display, manual:** on a two-screen setup, pop out the panel to the second screen, change symbol on the chart, and confirm the pop-out follows. Close and reopen the browser, and confirm the pop-out returns to its saved position.

## 5. Phases

| Phase | Work | Done when |
|---|---|---|
| A | Section 3.1 constants; parity test (4.2) | Test passes; no hand-typed price in code |
| B | Header menu (3.2); keyboard test (4.1) | Three tabs work with keyboard only |
| C | Account states (3.3); Pro refresh test (4.4) | Each Plan state shows its copy; offline shows the reason |
| D | Accessibility tokens, targets, focus, motion (3.4); axe and contrast test (4.3) | axe clean at WCAG 2.2 AAA, with exceptions listed |
| E | CI workflow (3.5) | PRs run compile, test and both builds |
| F | Manual pass (4.5); store checklist (section 2 blockers) | Store submission ready |
| G | Reproduce F1 (1a); site copy and limit message (3.9) | Steps recorded; no "no API key" in site; limit message gives a reason |
| H | Edge tab and pop-out window (3.7) | Chart clear with the edge tab; pop-out follows the chart on a second screen |
| I | Update gate (3.8); pure-function test (4.6) | Gate shows after an update or 14 idle days; "Continue" records it |

Phases A to E are code and can be merged one at a time. Phases G to I are independent of A to E. Phase F needs the human blockers in section 2 first.

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
