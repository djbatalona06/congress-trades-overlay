# SEO and legal review: 2026-10-18

Scope: the public website in `site/src/` and the data-use terms in `DATA_SOURCES.md`.
This is research, not legal advice. Section 2 needs a licensed lawyer before Pro launches.

## 1. Summary

| Area | Finding | Priority |
|---|---|---|
| Legal | 5 U.S.C. § 13107(c)(1)(B) bans using a disclosure report for a commercial purpose, except by news media. Pro is a paid product, so this is the main launch risk. | **Blocker for Pro** |
| Legal | Bargo's API terms do not yet confirm commercial use in writing (already noted in `DATA_SOURCES.md`). | **Blocker for Pro** |
| SEO | Semrush returned no data (no API units left on the account), so no keyword volume or difficulty numbers exist yet. | Info |
| SEO | On-page basics are in place: unique titles and descriptions per page, canonical tags, Open Graph tags, a generated `sitemap.xml`, and a `robots.txt` that blocks `/account.html`. | Good |
| SEO | Two meta descriptions run long (homepage 197 characters, TradingView guide 188). Search results cut off past about 160. | Low |
| SEO | Per-ticker landing pages are a proven pattern (one search surfaced a tracker that ranks per ticker). Capitol Tape has none. Any such page would republish disclosure data, so it has the same legal question as Pro. | Hold until Section 2 is answered |

## 2. Legal research

### 2.1 The statute

Source: [5 U.S.C. § 13107, U.S. Code, 2024 edition](https://www.govinfo.gov/content/pkg/USCODE-2024-title5/html/USCODE-2024-title5.htm), subsection (c)(1):

> It shall be unlawful for any person to obtain or use a report—
> (A) for any unlawful purpose;
> (B) for any commercial purpose, other than by news and communications media for dissemination to the general public;
> (C) for determining or establishing the credit rating of any individual; or
> (D) for use, directly or indirectly, in the solicitation of money for any political, charitable, or other purpose.

Under (c)(2), the Attorney General may sue and seek a penalty of up to $10,000, on top of other remedies.

### 2.2 How it applies to Capitol Tape

| Feature | Clause | Risk |
|---|---|---|
| Free trade box and Pro alerts, sold for $8/month | (B) commercial purpose | **High.** The exception covers news media disseminating to the public. Whether a paid browser extension counts as "news and communications media" is not settled. |
| Pro sold through ExtensionPay and Stripe | (B) | Same as above. Payment does not by itself make it commercial, but the paid tier is the commercial use. |
| Donations or other money requests | (D) | Low, as long as no feature asks users to give money to a cause or candidate. Check before launch. |
| Credit or lending use | (C) | None found. Keep it that way in marketing copy. |

Research notes:
- I searched the U.S. case law index for interpretations of § 13107(c). I found no opinion applying it. The hits covered identity requirements for access and enforcement against a data company, so this is an open question.
- One 1990 federal case, *FEC v. Political Contributions Data, Inc.*, involved the FEC trying to stop a company from using federal disclosure data commercially. I read only the search snippet, not the full opinion. Read it before relying on it.
- The statute's data-retention rule (§ 13107(d)) keeps reports public for six years. Bargo's 90-day window is shorter, so it does not conflict.

### 2.3 Data-supplier terms

`DATA_SOURCES.md` already says Bargo's commercial use is "not yet confirmed in writing." The statute applies to the report, and Bargo is a middleman. A written confirmation from Bargo covers the contract side. The statute question stays open after that.

### 2.4 Options for the product owner (not decided here)

1. **Get a written opinion first.** Ask a lawyer whether the paid tier fits the "news media" exception or another reading. Gate the Pro launch on that answer. This is the default in `DATA_SOURCES.md` section "Legal limits on use."
2. **Keep the disclosure data free, charge for convenience.** Paid features would be notifications and the watchlist size, not the trade records. This reduces the (B) question but does not remove it.
3. **Publish the data as news.** This only works if the product is run as a news publication. It is a business and editorial decision, not a code change.
4. **Hold per-ticker SEO pages** until one of the above is settled, because they republish the data on the open web.

### 2.5 Items to check before launch

- Written confirmation from Bargo on commercial use (ask for it by email and file it in the repo's docs).
- The lawyer's opinion on § 13107(c)(1)(B), in writing.
- Make sure the Terms of Service and the Chrome Web Store disclosure match whatever is decided.
- Check that the "not financial advice" line appears wherever a trade is shown.

## 3. SEO research

### 3.1 Semrush

The Semrush connector returned `no_api_units`. The account has no API units left, so no keyword volume, difficulty, organic keyword, backlink, or competitor data is available. Once the account has units, the reports below are the ones to run:

- `domain_overview` and `organic_research` for `capitol-tape.pages.dev`
- `keyword_research` for "congress stock trades", "STOCK Act disclosures", and "congress trade tracker"
- `site_audit`, if a Semrush project is set up for the site

The keyword candidates in 3.3 are unverified until that data is pulled.

### 3.2 On-page audit (from the source)

Pages use the shared `Head` partial (`site/src/components/Head.html`). It sets `<title>`, description, canonical, Open Graph, and Twitter card tags. The build script (`scripts/build-site.mjs`) writes `sitemap.xml` and `robots.txt`, so both exist in the built site.

| Page | Title length | Description length | Note |
|---|---|---|---|
| Homepage | 47 | 197 | Trim the description to about 155 to 160. |
| TradingView guide | 63 | 188 | Trim the description. Title runs slightly past 60. |
| Bargo API guide | 69 | 173 | Trim the title (runs past 60). |
| FAQ | 20 | 142 | Fine. |
| Pricing | 24 | 121 | Fine. |
| STOCK Act guide | 48 | 152 | Fine. |
| Guides index | 23 | 134 | Fine. |

Lengths are character counts of the `title` and `description` attributes in source, measured with `wc -m`.

Other notes:
- The homepage hero `<h1>` is a `{{title}}` placeholder in source. The build fills it in, so the rendered page is fine. Confirm the built output has one `<h1>`.
- The JSON-LD `SoftwareApplication` block on the homepage lists both offers. Keep it in sync with the Pro price.

### 3.3 Competitive check and keyword candidates

One standard web search for "congress stock trades tracker STOCK Act disclosure website" returned a single competitor, holdingsintel.com, with `/congress?q=TICKER` pages. That suggests search engines index per-ticker pages for this topic. The search covered one query only, so it is a signal, not a full survey.

Candidate topics for guides (unverified volume):
- How to see congressional stock trades on a specific stock
- What a STOCK Act disclosure is and how late it can be (already covered)
- Congress trade data sources and their limits (already covered in the API guide)

Per-ticker pages are the strongest SEO pattern seen, and they carry the Section 2 risk. Hold them.

## 4. Recommended next steps

1. **Now:** get the Bargo written confirmation and the lawyer's opinion on § 13107(c)(1)(B). Pro does not launch until both are in hand.
2. **Now, no legal risk:** trim the homepage and TradingView guide meta descriptions, and shorten the Bargo guide title. These are copy changes, so review them on the page before merging.
3. **When Semrush has units:** run the reports in 3.1 and replace the candidates in 3.3 with measured volume and difficulty.
4. **After step 1:** decide the per-ticker page question with the lawyer's answer in hand.

## 5. Limits of this review

- Semrush data is missing (Section 3.1).
- The legal research is one statute, one search of U.S. case law, and one snippet from an analogous case. It is not a full legal analysis, and the case law search was not exhaustive.
- I did not check any state law. Some states have their own rules on personal data or financial data, and they may apply.
- Nothing in this document is legal advice. A licensed attorney must review it before the Pro launch.
