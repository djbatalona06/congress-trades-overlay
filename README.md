# Capitol Tape

**Website: [capitol-tape.pages.dev](https://capitol-tape.pages.dev)**

## What is it?

Capitol Tape is a helper for your web browser. A helper like this is called an *extension*.

People in Congress make our country's laws. Some of them also buy and sell stocks. A stock is a tiny piece of a company.

There is a law called the STOCK Act. It says people in Congress must tell everyone when they buy or sell a stock. They write it down on a form. Anyone can read these forms.

Capitol Tape finds those forms for you. When you look at a stock's chart on a website, a small box pops up in the corner. The box shows who in Congress bought or sold that stock, and when.

## What the colors mean

- **Green** means *buy*. Green is also the color of a price going up.
- **Red** means *sell*. Red is also the color of a price going down.

## The signal box

When you open a stock, a small floating box shows up in the bottom-left corner. It says how busy Congress has been in that stock: **Quiet**, **Watch** or **Hot**. A ring around a number fills up as the stock gets busier.

Under the ring are little tags. Tap one to read, in plain words, why it is lit.

| Tag | What it means |
|---|---|
| Cluster buy / Cluster sell | 3 different members bought (or sold) the same stock within 30 days of each other |
| Both parties buying | A Democrat and a Republican both bought within 30 days |
| Big trade | A form says the trade went above $250,000. Forms only give ranges, not exact amounts |
| Fresh filing | A form was made public in the last 7 days |
| Filed late | A form came in more than 45 days after the trade. That is past the legal deadline. It adds no points |
| Policy nearby | A related bill or order from the President moved within 30 days of a trade (only shows when that extra data is on) |

The box is **free**. It uses the same forms the panel already has, so it never uses up more of your daily look-ups. You can drag it anywhere (or click the dots and use the arrow keys). Turn it off in the Capitol Tape popup under **Floating signal box**.

Pro ($8/month) adds one more message: you are told when a stock you watch turns **Hot**.

The box only reports what the forms say. It is **not** advice. Read [docs/signals-explained.md](docs/signals-explained.md) for exactly how the score is worked out.

## Where it works

It works on these four stock websites:

1. TradingView
2. Robinhood
3. Webull
4. Schwab

It works in the Chrome and Firefox web browsers.

## How to use it

1. Add Capitol Tape to your browser.
2. Open a stock on one of the four websites.
3. Look at the right edge of the chart. A small tab shows the stock and how many trades there are. Click it to open it. Press Esc to close it.
4. Click the star to watch a stock. You can get a message when someone in Congress trades it.
5. Have two screens? Click **Pop out** (the little box with an arrow). The trades open in their own window. Drag it to your second screen and it follows the chart.

## Is it safe?

Yes. Capitol Tape only reads the stock's name from the web page. It cannot see your money. It cannot buy or sell anything for you. It does not know who you are.

## Does it cost money?

- **Free:** you get the trade box and the signal box on all four websites. You can watch 3 tickers (a ticker is a stock's short name, like NVDA).
- **Pro ($8/month):** you can watch as many stocks as you want. You also get a message when there is a new form, or when a stock you watch turns Hot.

## Do I need a key?

No. Capitol Tape works the first time you open it. A "key" is like a library card for the data. It is free and you do not have to get one.

Without a key you get about 20 stock look-ups a day. With a free key from [Bargo](https://www.bargo.ai/connect) you get more. If you see "daily limit reached", you used up the free look-ups for now. Get a key, then paste it in the Capitol Tape popup (the **Lookups** tab).

## Important

Capitol Tape is **not** advice about money. It only shows forms that anyone can already read. The forms can be up to 45 days late, because the law gives Congress that much time. Always ask a grown-up you trust before you spend money on stocks.

## The folders in this project

| Folder | What is inside |
|---|---|
| `entrypoints/` | The parts you see: the pop-up box and the menu |
| `lib/` | The brain: finds the stock name and gets the forms |
| `site/` | The website |
| `tests/` | Checks that make sure everything still works |
| `worker/` | An extra helper on the internet (turned off for now) |
| `docs/` | The plan for the whole project |

## For grown-up builders

```sh
npm install      # get the tools
npm test         # run the checks
npm run build    # build the Chrome version
npm run zip      # pack it up for the Chrome Web Store
```

The website updates by itself. When a change to the `site/` folder lands on `master`, GitHub sends it to Cloudflare Pages. See `.github/workflows/deploy-site.yml`.
