# Security

## Reporting a problem

Please email the contact address on [capitol-tape.pages.dev/security.html](https://capitol-tape.pages.dev/security.html) with **"Security report"** in the subject. Do not open a public GitHub issue for a security problem.

Include:

- what you found and where (extension, website, or Worker);
- steps to reproduce it;
- what an attacker could do with it.

We reply within 5 working days, keep you updated, and credit you in the changelog if you want. Please give us a reasonable time to fix it before telling anyone else.

## What is in scope

| Part | Where |
|---|---|
| Browser extension | `entrypoints/`, `components/`, `lib/` |
| Website | `site/` (served by Cloudflare Pages) |
| Worker (optional data service and sign-in) | `worker/` |

Out of scope: problems in TradingView, Robinhood, Webull, Schwab, Bargo, ExtensionPay or Stripe themselves (report those to them), and reports that need a compromised computer or browser.

## How the extension stays small

- Three permissions: `storage`, `alarms`, `notifications`. Host access to `bargo.ai` only (plus `extensionpay.com` on Firefox). See [docs/permissions.md](docs/permissions.md).
- Content scripts read only the ticker from the page address or title. No page content, cookies, or brokerage data is read.
- No remote code. No analytics.
- Payments happen on ExtensionPay and Stripe pages; card details never reach the extension.

## Secrets

- No secret belongs in this repository or in the website. The site build reads only public values (`SITE_*` env vars) and writes them into a public `config.js`.
- Worker secrets (OAuth client secrets, session key) are set with `wrangler secret put` and never committed. See `worker/README.md`.
- `.env` files are git-ignored. `.env.example` lists names only.
