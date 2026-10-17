# Brand and voice

How Capitol Tape looks and talks. The site's CSS tokens live in `site/src/styles/styles.css`.

## Positioning

**Nonpartisan congressional trade data, right on your chart.**

Three facts go with it everywhere: public disclosure data; read-only, no brokerage access; information only, not advice.

## Look

- **Neutral first.** The logo slate (`#172536`) for buttons, links and focus. Slate for text and lines. White and `#f8fafc` for backgrounds.
- **Colour means a signal.** Only the signal levels get colour: Quiet (slate), Watch (amber), Hot (red). Each always has its own icon and its word, so colour is never the only cue.
- **Buy and sell** may use green and red, but only inside trade data (the panel, the chart flags).
- **No party colours.** Party is shown as a letter (D, R, I) on a neutral badge. No red-versus-blue branding.
- **Logo:** the mark in `brand/` — a disclosure strip with a rising teal signal line, on a slate tile for small sizes — plus the "Capitol Tape" wordmark. Colours: slate `#172536`, off-white `#F7F8F6`, muted teal `#4D9A88`. No Capitol dome, no flag, no stars and stripes. Use the files in `brand/` as they are; don't redraw the mark.
- **Type:** Inter for everything you read and click (16px minimum for body text). Source Serif 4 semibold for page and section headlines.
- **Spacing:** an 8px grid (`--s1` = 8px … `--s10` = 80px).
- **Buttons:** primary (slate) and secondary (white with a slate border). One primary per view.

## Voice

Factual, calm, useful. Write like a well-made public-records page, not a trading app.

| Say | Don't say |
|---|---|
| public disclosure data | insider data, secret trades |
| information only | signals to trade on, alpha, edge |
| a member disclosed a trade | politicians are buying |
| Quiet / Watch / Hot shows filing activity | Hot means buy |
| delayed up to 45 days by law | real-time, live |
| see what was filed | copy Congress's trades, beat the market |

Rules:

1. Never imply the data predicts prices.
2. Never single out a party or a member as good or bad.
3. Every page that shows trade data says "not financial advice" and that filings are delayed.
4. Testimonials and numbers must be real and checkable.
