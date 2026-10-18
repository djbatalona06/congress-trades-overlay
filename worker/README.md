# Worker backend

A small Cloudflare Worker that holds the Congress.gov key, keeps bills and executive orders in D1, and answers the extension.

```
GET /v1/ticker/{T}[?days=30]
-> { "trades": [...], "related_bills": [...], "exec_orders": [...], "ie_spend": [...], "tax_flags": [...], "lobbying": [...] }
```

- `trades`: Bargo rows as returned, cached 6 hours per ticker so all users share one lookup.
- `related_bills`: bills that passed a chamber, reached the President or became law, whose Congress.gov policy area maps to the ticker's sector (`src/sectors.ts`). Newest first, up to 10.
- `exec_orders`: Federal Register executive orders whose title or abstract names the sector. Up to 10.
- `ie_spend`: outside spending in the races of members in `trades` (FEC, last 365 days, up to 10). `tax_flags`: only person-reviewed tax provisions in the returned bills. `lobbying`: Senate filings on issue codes tied to the sector (`SECTOR_ISSUE_CODES`). All three are empty until their jobs have run.
- Unknown ticker (not in the seed list in `src/sectors.ts`): trades only, empty lists. Nothing is guessed.
- `days`: 1 to 365, default 30. History starts when the cron first runs (14 days of bills on the first run).
- Errors: `400 bad_ticker`, `404 not_found`, `405 method_not_allowed`, `502 unavailable` (no trades from upstream and none saved).

Copy rule: the extension calls these "related legislation", never "impact" and never a recommendation.

## Cron jobs

| Cron (UTC) | Job |
|---|---|
| `7 * * * *` | Congress.gov bills updated since the last run, then policy areas for up to 40 new bills |
| `17 */6 * * *` | Federal Register executive orders from the last 90 days |
| `47 4 * * *` | Member to FEC candidate links (public legislators list, no key) |
| `37 * * * *` | Outside spending for the 25 members synced longest ago (needs `FEC_API_KEY`; skipped without it) |
| `27 */6 * * *` | Senate lobbying filings posted since the last run, on confirmed issue codes |

## Set up

```bash
cd worker && npm install
npx wrangler d1 create congress-trades          # paste the printed id into wrangler.toml
npm run migrate                                 # creates the tables
npx wrangler secret put CONGRESS_API_KEY        # free key from api.data.gov
npx wrangler secret put FEC_API_KEY             # free key from api.data.gov (outside money)
npx wrangler secret put LDA_API_TOKEN           # optional
npx wrangler secret put BARGO_API_KEY           # optional
npm run deploy
```

Local try-out (no cloud account needed): `npm run migrate:local && npm run dev`, then `curl localhost:8787/v1/ticker/LMT`. Trigger a cron with `curl "localhost:8787/__scheduled?cron=7+*+*+*+*"`.

## Website sign-in (Google and GitHub)

The same Worker signs people in for the website's login and account pages. It is optional and separate from the extension.

```
GET  /auth/{google|github}/start      -> sends the browser to Google or GitHub
GET  /auth/{google|github}/callback   -> they send it back; we make or find the account, then set a session cookie
GET  /auth/me                         -> { "name", "email", "provider" }, or 401 when signed out
POST /auth/logout                     -> ends the session (204)
```

How it keeps people safe: a random `state` and a PKCE check on every sign-in, accounts matched on the service's own user id (never the email), a verified email required, the session cookie is `HttpOnly; Secure`, only a hash of it is stored, and only `SITE_ORIGIN` may read `/auth/me` or call `/auth/logout`.

### Turn sign-in on (about 10 minutes, all by hand)

1. **Pick the addresses.** Deploy the Worker once (`npm run deploy`) and note its address, for example `https://congress-trades-api.<you>.workers.dev`. The website address is `https://capitol-tape.pages.dev`.
2. **Google.** In the [Google Cloud console](https://console.cloud.google.com/apis/credentials): create an *OAuth client ID*, type *Web application*. Add this *Authorized redirect URI*: `<worker address>/auth/google/callback`. Copy the client ID and secret. (Google will ask you to set up the consent screen first: app name, your email, scopes `openid`, `email`, `profile`.)
3. **GitHub.** In *GitHub → Settings → Developer settings → OAuth Apps → New OAuth App*: *Homepage URL* is the website address and *Authorization callback URL* is `<worker address>/auth/github/callback`. Copy the client ID and generate a client secret.
4. **Put the ids in `wrangler.toml`** (`GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`) and the secrets in Cloudflare, never in a file:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```
5. **Create the tables and deploy:** `npm run migrate && npm run deploy`.
6. **Tell the website where the Worker is:** set the `SITE_AUTH_BASE` repository variable to the Worker address and re-run "Deploy site". The sign-in buttons wake up on their own.

Until step 6, the login page says sign-in "isn't switched on yet". With no ids set, `/auth/*` answers `503 auth_not_configured`.

**Known limit.** The website (`pages.dev`) and this Worker (`workers.dev`) are different sites, so a browser that blocks cross-site cookies (Safari, or Chrome with that setting) can show the account page as signed out even after a good sign-in. The fix is to serve both from one custom domain. Do that before relying on the account page.

## Turn it on in the extension

Build with the flag; the Worker address also becomes the only new host permission.

```bash
WXT_USE_WORKER=true WXT_WORKER_URL=https://congress-trades-api.<you>.workers.dev npm run build
```

Without the flag, nothing changes: the extension talks to Bargo as before. With it, a failed Worker call falls back to Bargo.

## Privacy

The ticker route never reads or stores the caller's address, sets no cookies, and request logging is off (`[observability]` in `wrangler.toml`). The extension sends only the ticker. Only the optional `/auth/*` routes set cookies (a 10-minute sign-in cookie and the session cookie) and store a name, email and service id for people who choose to sign in. Say so in `site/src/legal/privacy.html` (already done) and keep it true. Cloudflare itself still sees connecting addresses at its edge, as with any hosted site.

## Before you switch it on for users

1. `docs/privacy.html` still says the extension has no server. Update it, and the permission table in `CHROMEWEBSTORE.md`, in the same release.
2. `TRADE_SOURCE=bargo` proxies Bargo's free, personal-use API for everyone. Bargo's cap (30 requests and 100 rows a day without a key, 100 and 1,000 with one) is about 20 to 200 distinct tickers a day, and its terms are silent on commercial use. Ask Bargo, or move to a licensed vendor, before charging. `TRADE_SOURCE=none` returns only the legislation lists.
3. 5 U.S.C. 13107(c) still needs a lawyer's answer (spec section 7).
4. The Congress.gov and Federal Register parsing follows their published docs and is covered by fixture tests, but it has not been run against the live APIs yet. Watch the first cron runs (`npx wrangler tail`) and check `bills` and `executive_orders` fill up.

## Checking the ids and codes

`FEC_API_KEY=... npm run verify:influence` (from the repo root, with internet access) asks the FEC and Senate sites whether each member id, committee id and issue code is real and named as expected, and writes `docs/influence-verification-<date>.md`. It only reads. Run it before relying on the Influence data.

## Waitlist

`POST /waitlist` takes `{ email, list, ref? }` from the website, where `list` is `mobile`, `desk` or `beta`. It stores the email, gives the person an 8-character share code, and records which share code (if any) brought them. Joining twice returns the same code. Only the website's origin (`SITE_ORIGIN`) can call it; a hidden form field catches simple bots.

1. Apply the table: `npx wrangler d1 migrations apply congress-trades --remote` (adds `0005_waitlist.sql`).
2. Make sure `SITE_ORIGIN` is set (the same setting sign-in uses).
3. Set the website's `SITE_AUTH_BASE` repository variable to the Worker address. The form on the home page wakes up on its own.
4. Optional: add a Cloudflare rate-limiting rule for `/waitlist` (for example 10 requests a minute per IP) in the dashboard under Security > WAF.

Read the list: `npx wrangler d1 execute congress-trades --remote --command "SELECT list, email, ref_code, referred_by, created_at FROM waitlist ORDER BY created_at"`.
