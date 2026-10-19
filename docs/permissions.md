# Extension permissions

What the extension asks for, why, and what it never does. Keep this in sync with `wxt.config.ts`, `CHROMEWEBSTORE.md` and `site/src/legal/security.html`.

| Permission | Asked on | Why | Code |
|---|---|---|---|
| `storage` | Chrome, Firefox | Watchlist, cached results (6 h), daily lookup count, panel and signal-box settings, pop-out position, last version seen, optional Bargo key | `lib/settings.ts`, `lib/cache.ts`, `lib/budget.ts`, `lib/watchlist.ts` |
| `alarms` | Chrome, Firefox | Hourly watchlist check (Pro); clearing old cache | `entrypoints/background.ts` |
| `notifications` | Chrome, Firefox | New filing or "turned Hot" on a watched ticker (Pro) | `lib/alerts.ts` |
| Host `https://www.bargo.ai/*` | Chrome, Firefox | Fetch filings for the ticker on screen | `lib/bargo.ts` |
| Host `https://extensionpay.com/*` | Firefox only | ExtensionPay's README requires it on Firefox | `lib/extpay.ts` |
| Worker origin | Only when built with `WXT_USE_WORKER=true` | Optional hosted data service | `lib/worker.ts` |
| Content script on `tradingview.com`, `robinhood.com`, `www.webull.com`, `www.schwab.com` | Chrome, Firefox | Read the ticker from the URL or title; draw the panel and signal box | `lib/platforms/`, `entrypoints/overlay.content/` |

## What it never does

- Read page content beyond the URL and title.
- Read cookies, history, or other tabs.
- Click, type, submit forms, or call the platform's APIs.
- Read balances, positions or orders, or place trades.
- Load remote code or send analytics.

## Adding a permission

A new permission changes the store review and the data-use disclosure. Before adding one:

1. Write why in this file.
2. Update `CHROMEWEBSTORE.md`, `site/src/legal/security.html` and, if data leaves the browser, `site/src/legal/privacy.html`.
3. Mention it in the release note in `lib/update.ts`, so returning users are told.
