# Marketing launch plan

How to tell people about Capitol Tape without overselling it. Pairs with `docs/brand-voice.md` (what to say) and the launch spec, section 8.

## Before any promotion

- [ ] Store listings live; `SITE_CHROME_URL` and `SITE_FIREFOX_URL` set.
- [ ] Legal sign-off on 5 U.S.C. § 13107(c) (spec 7.1). Until then, promote the **free** extension only; do not run paid ads for Pro.
- [ ] Store screenshots without third-party interfaces or logos.
- [ ] Waitlist live: migration `0005_waitlist.sql` applied, Worker deployed, `SITE_AUTH_BASE` set.

## Channels, in order

| # | Channel | What to post | Rules to check first |
|---|---|---|---|
| 1 | Chrome Web Store, Firefox Add-ons | Listing copy from `CHROMEWEBSTORE.md`, the not-advice line in every screenshot | Store policies on financial claims |
| 2 | Reddit: r/TradingView, r/stocks, r/investing, r/algotrading (API guide) | "I made a free extension that shows STOCK Act filings on the chart." Link the TradingView guide, not the home page. Answer every comment | Each subreddit's self-promotion rule; many allow it only in weekly threads |
| 3 | TradingView community, finance Discords | Short demo, the guide link, ask for beta testers | Server rules; ask a moderator first |
| 4 | Niche newsletters (disclosure trackers, retail-trading) | Offer the Desk preview and a quote from the maker | Disclose that it is your product |
| 5 | Product Hunt | Launch after 10 verified reviews | Launch on a Tuesday–Thursday |

## Post template

> I built Capitol Tape, a free Chrome/Firefox extension. When you open a stock on TradingView, Robinhood, Webull or Schwab, it shows which members of Congress disclosed trading it, with dates and amount ranges, from public STOCK Act filings.
>
> It's read-only (no brokerage access), filings can be up to 45 days late, and it's information only, not advice. Guide: https://capitol-tape.pages.dev/guides/tradingview-congress-trades.html
>
> Looking for beta testers who'll tell me what's broken.

## Content and search

Guides live in `site/src/pages/guides/` and are listed in `sitemap.xml` automatically:

1. How to see congressional trades on TradingView
2. STOCK Act disclosures explained
3. Congress trade data API

Next guides to consider: "Robinhood congressional trades", "How late are congressional trade disclosures?", "What is a periodic transaction report?". Each must say "not advice" and link to the official sources.

After launch: submit `https://capitol-tape.pages.dev/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Social proof

- Collect quotes only from real people, with written permission (save the email), or quote a public store review and link to it.
- Add them with the `Testimonial` component; it requires a source link.
- Show the store rating on the site once there are 10 or more ratings.
- Never write a quote, a name, a job title or a number that you cannot show proof for.

## Waitlist and referrals

- Lists: mobile, Desk, beta. Each sign-up gets a share link; the Worker counts who joins through it.
- Reward is **not** chosen yet, and the site promises none beyond "we'll thank early sharers first". Options once decided: waitlist priority, an early Desk seat, or a free Pro month (check ExtensionPay coupon support first).
- "Extra lookups" cannot be a reward: Bargo sets the lookup limit per network, not Capitol Tape.
- Export the list: `wrangler d1 execute congress-trades --remote --command "SELECT list, email, ref_code, referred_by FROM waitlist"`.

## Measuring

There is no analytics on the site or the extension (a privacy promise). Measure with: store install counts, store ratings, waitlist sign-ups per list, referral counts, and Search Console impressions for the guides.
