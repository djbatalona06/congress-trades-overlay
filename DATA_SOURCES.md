# Data sources

Every piece of data Capitol Tape shows, where it comes from, and its limits. The public version is [capitol-tape.pages.dev/data.html](https://capitol-tape.pages.dev/data.html).

| Data | Source | Licence / terms | Refresh | Limits |
|---|---|---|---|---|
| Congressional trades (member, ticker, buy/sell, amount range, trade date, filing date) | [Bargo Congress Trades API](https://www.bargo.ai/) `GET /free-apis/congress/v1/trades/{ticker}` | Bargo's API terms. **Commercial use not yet confirmed in writing** (see spec 7.1) | Fetched per ticker, kept on device up to 6 hours | Last ~90 days. Keyless: about 30 requests a day per network; free key raises it. No party field, no filing id |
| Party, chamber, state/district | [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) `legislators-current.json` | Public domain (CC0) | By hand: `npm run party-map` after elections | Matched by name; can miss after a name change |
| Official records (linked, not copied) | [House Clerk](https://disclosures-clerk.house.gov/FinancialDisclosure), [Senate eFD](https://efdsearch.senate.gov/) | Public records under the STOCK Act and the Ethics in Government Act | — | Up to 45 days after the trade |
| Influence layer (off by default) | FEC, Senate LDA, Congress.gov, Federal Register via the Worker | Public APIs | Worker cron | See `docs/influence-explained.md` |

## Legal limits on use

5 U.S.C. § 13107(c) makes it unlawful to use these financial disclosure reports for any unlawful purpose, for any commercial purpose other than by news and communications media for dissemination to the general public, to determine a credit rating, or to solicit money. Pro and the Desk tier need a lawyer's sign-off before launch. See `docs/2026-10-17-site-launch-spec.md`, section 7.1.

## Accuracy

Capitol Tape shows filings as received. It does not correct them. Filings can be late, amended, incomplete or wrong, and amounts are legal ranges. Every user-facing surface says "not financial advice" and that data is delayed.

## When a source changes

1. Update this file and `site/src/legal/data.html` in the same pull request.
2. If the change affects what leaves the user's browser, also update `site/src/legal/privacy.html`, `CHROMEWEBSTORE.md` (data-use disclosure) and `docs/permissions.md`.
