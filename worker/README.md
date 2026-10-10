# Worker backend

A small Cloudflare Worker that holds the Congress.gov key, keeps bills and executive orders in D1, and answers the extension.

```
GET /v1/ticker/{T}[?days=30]
-> { "trades": [...], "related_bills": [...], "exec_orders": [...] }
```

- `trades`: Bargo rows as returned, cached 6 hours per ticker so all users share one lookup.
- `related_bills`: bills that passed a chamber, reached the President or became law, whose Congress.gov policy area maps to the ticker's sector (`src/sectors.ts`). Newest first, up to 10.
- `exec_orders`: Federal Register executive orders whose title or abstract names the sector. Up to 10.
- Unknown ticker (not in the seed list in `src/sectors.ts`): trades only, empty lists. Nothing is guessed.
- `days`: 1 to 365, default 30. History starts when the cron first runs (14 days of bills on the first run).
- Errors: `400 bad_ticker`, `404 not_found`, `405 method_not_allowed`, `502 unavailable` (no trades from upstream and none saved).

Copy rule: the extension calls these "related legislation", never "impact" and never a recommendation.

## Cron jobs

| Cron (UTC) | Job |
|---|---|
| `7 * * * *` | Congress.gov bills updated since the last run, then policy areas for up to 40 new bills |
| `17 */6 * * *` | Federal Register executive orders from the last 90 days |

## Set up

```bash
cd worker && npm install
npx wrangler d1 create congress-trades          # paste the printed id into wrangler.toml
npm run migrate                                 # creates the tables
npx wrangler secret put CONGRESS_API_KEY        # free key from api.data.gov
npx wrangler secret put BARGO_API_KEY           # optional
npm run deploy
```

Local try-out (no cloud account needed): `npm run migrate:local && npm run dev`, then `curl localhost:8787/v1/ticker/LMT`. Trigger a cron with `curl "localhost:8787/__scheduled?cron=7+*+*+*+*"`.

## Turn it on in the extension

Build with the flag; the Worker address also becomes the only new host permission.

```bash
WXT_USE_WORKER=true WXT_WORKER_URL=https://congress-trades-api.<you>.workers.dev npm run build
```

Without the flag, nothing changes: the extension talks to Bargo as before. With it, a failed Worker call falls back to Bargo.

## Privacy

The Worker never reads or stores the caller's address, sets no cookies, and keeps request logging off (`[observability]` in `wrangler.toml`). The extension sends only the ticker. Cloudflare itself still sees connecting addresses at its edge, as with any hosted site.

## Before you switch it on for users

1. `docs/privacy.html` still says the extension has no server. Update it, and the permission table in `CHROMEWEBSTORE.md`, in the same release.
2. `TRADE_SOURCE=bargo` proxies Bargo's free, personal-use API for everyone. Bargo's cap (30 requests and 100 rows a day without a key, 100 and 1,000 with one) is about 20 to 200 distinct tickers a day, and its terms are silent on commercial use. Ask Bargo, or move to a licensed vendor, before charging. `TRADE_SOURCE=none` returns only the legislation lists.
3. 5 U.S.C. 13107(c) still needs a lawyer's answer (spec section 7).
4. The Congress.gov and Federal Register parsing follows their published docs and is covered by fixture tests, but it has not been run against the live APIs yet. Watch the first cron runs (`npx wrangler tail`) and check `bills` and `executive_orders` fill up.
