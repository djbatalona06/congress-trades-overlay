# Chrome Web Store / Firefox Add-ons Listing — Congress Trades Overlay

Last updated: 2026-10-07 · Version 1.0.0 · Not yet submitted

## Listing

- **Name:** Congress Trades Overlay
- **Category:** Productivity
- **Short description (132 max):** See recent STOCK Act congressional trade disclosures overlaid on stock charts. Read-only. Not financial advice.
- **Single purpose:** Displays publicly available U.S. congressional stock trade disclosures (STOCK Act data) for the stock shown on supported chart and quote pages. It is a read-only information display.

**Detailed description**

Shows what members of Congress have disclosed trading in the stock you are looking at, in a small panel on the page.

- Works on stock pages at TradingView, Robinhood, Webull and Schwab
- Shows each disclosure's member, party, chamber, buy or sell, amount range, trade date and filing date
- On a corporate bond chart, shows disclosures for the issuing company's stock
- Free: the panel plus a 3-ticker watchlist
- Pro ($8/month): unlimited watchlist and a notification when a watched ticker gets a new disclosure

What it does not do: place trades, access your brokerage account, read balances or positions, or give investment advice.

Data: Bargo Congress Trades API (bargo.ai), covering roughly the last 90 days. Disclosures are filed up to 45 days after a trade. For information only; not financial, investment or trading advice. Not affiliated with or endorsed by TradingView, Robinhood, Webull, Schwab or the U.S. Congress.

## Permission justifications

| Permission | Justification |
|---|---|
| `storage` | Saves the watchlist, recent lookup results, the daily lookup count and panel preferences on the device. |
| `alarms` | Runs an hourly check of watched tickers for new disclosures (Pro) and clears old saved results. |
| `notifications` | Tells the user when a watched ticker has a new congressional disclosure (Pro). |
| Host `https://www.bargo.ai/*` | Fetches public disclosure data for the ticker on screen from the Bargo API. |
| Content script on `tradingview.com`, `robinhood.com`, `www.webull.com`, `www.schwab.com` | Reads the ticker symbol from the page address or title and displays the panel on that page. No other page content is read. |
| Firefox only: host `https://extensionpay.com/*` | Lets the payment library check subscription status. |

Remote code: none. All code is in the package.

## Data use disclosure

- **Collected/transmitted:** the ticker symbol of the page being viewed and watchlist tickers, sent to Bargo to retrieve data (Chrome category: *Website content*; Firefox: `websiteContent`). Subscription status is checked with ExtensionPay.
- **Not collected:** personal information, authentication data, financial account data, location, browsing history.
- Certify: not sold; not used for purposes unrelated to the single purpose; not used for creditworthiness or lending.
- ExtensionPay uses `storage.sync`, which the browser may sync through the user's account.
- **Privacy policy URL:** _publish `docs/privacy.html` and paste the URL here_

## Assets

| Asset | State |
|---|---|
| Icons 16/32/48/128 | Done (`public/icon`, from `scripts/build-icons.mjs`) |
| Screenshots 1280×800, disclaimer visible | To do |
| Small promo tile 440×280 | Optional, to do |

## Before submitting

- [ ] Developer account, $5 fee, 2-Step Verification, trader declaration
- [ ] ExtensionPay extension registered as `congress-trades-overlay` with the $8/month plan; test-mode payment passes
- [ ] Contact email filled into `docs/privacy.html`; page published
- [ ] Reply from Bargo on commercial use; legal advice on 5 U.S.C. 13107(c)(1)
- [ ] `npm test`, `npm run zip`, `npm run zip:firefox`
- [ ] Load unpacked and click through all four sites; run once in Firefox

## Version history

| Version | Date | Notes |
|---|---|---|
| 1.0.0 | — | First release |
