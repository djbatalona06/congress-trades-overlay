# How Bargo affects Capitol Tape

Written in plain words. If a word is new, the short answer is in brackets.

## What Bargo is to this project

Bargo is a website that publishes the forms Congress members file when they buy or sell stocks. Capitol Tape asks Bargo for those forms and shows them next to the chart. **Bargo is the only place the data comes from.** If Bargo stops, changes its rules, or says no, the panel has nothing to show. (The address is in `lib/bargo.ts`.)

## The three ways Bargo touches the product

### 1. A daily limit on look-ups

| | Requests a day | Rows a day | About how many chart look-ups |
|---|---|---|---|
| No key (default) | 30 | 100 | about 20 |
| Free Bargo key | 100 | 1,000 | about 100 |

(Numbers come from the project's own notes in `docs/2026-10-07-congress-trades-overlay-spec.md`; they were checked then, not again today.)

- The no-key limit is shared by everyone on the same internet connection. A home or office with several users can use it up fast. That is the likely cause of finding F1 in the PRD.
- The extension counts its own look-ups (`lib/budget.ts`) and keeps results saved on the device so the same stock is not asked for twice.
- **We do not know when Bargo's limit resets.** The code counts days by UTC, but its own comment says Bargo's real reset time is not documented. So the code tries one look-up every hour after the limit is hit, to notice a reset. For that reason the on-screen message says "Daily free limit reached" and never names a clock time.
- A key is **optional**. The site, README and panel now say so, and every place that asks for a key uses one link: `https://www.bargo.ai/connect`.

### 2. Rules for using the data

- **Credit.** Bargo's terms ask for a visible "Data via Bargo" credit next to the data. It stays in the panel, the popup, the pop-out window and the site.
- **Licence.** The project's notes say Bargo's licence is "free, personal", says nothing about selling, and bars products that compete with Bargo's own data. **Capitol Tape Pro costs $8/month, so this has to be settled with Bargo before launch.** It is the biggest open risk to the paid plan.

### 3. A law question that Bargo cannot answer

5 U.S.C. 13107(c)(1) limits commercial use of these disclosure reports. A disclaimer in the extension does not fix that. This is not a Bargo question, but it sits on top of the same data. **Get a lawyer's advice before promoting Pro.** (This document is not legal advice.)

## Do the new features use more of Bargo's limit?

No.

| New thing | Extra Bargo calls? | Why |
|---|---|---|
| Edge tab | None | Same data as the old box |
| Pop-out window | None | It asks the same background code, which shares one saved copy and merges identical requests |
| Popup tabs, plan messages | None | Plan status comes from ExtensionPay, not Bargo |
| Update notes card | None | It reads the version and the saved budget only |
| New limit message | None | It only adds the key link |

Opening the pop-out and the on-page panel for the same stock costs one look-up, not two.

## What could go wrong, and what to do

| Risk | Likelihood | What to do |
|---|---|---|
| Bargo says no to commercial use | Unknown | Ask Bargo in writing before launch. Fallback: the optional Worker in `worker/` (own data store). It is a bigger job, not a quick fix |
| Many users hit the no-key limit | Likely on shared networks | The message explains it and links to the free key |
| Bargo changes its API or limits | Possible | Tests in `tests/bargo.test.ts` show what broke; the budget numbers live in `lib/budget.ts` |
| Reset time guessed wrong | Already handled | Hourly probe; message names no time |

## Finding F1: reproduction steps (not yet run)

This could not be run here: the sandbox cannot reach Bargo, and a real answer needs a real home network. A person should do this:

1. Fresh browser profile, install the build, **do not** add a key.
2. Open a supported chart. Switch between different tickers, counting each new one.
3. Write down how many look-ups happen before the panel says "(daily limit reached)". The code predicts about 20.
4. Repeat from a second network (for example a phone hotspot). If the count starts again, the limit is per network, as expected.
5. Add a free key from `https://www.bargo.ai/connect`, paste it in the popup's **Lookups** tab, and confirm the panel works again.

## Things still to confirm with Bargo

- [ ] Written permission to use the data in a paid product.
- [ ] When the daily limit really resets.
- [ ] That `https://www.bargo.ai/connect` is the right place to get a key (the link could not be opened from the sandbox).
