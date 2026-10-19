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

No. Everything is free: the box on all four websites, a watchlist with no limit, and a message when a stock you watch gets a new form. Each trade has a link to the official House or Senate records.

A paid add-on about bills and laws ("Policy Pro") is planned. It will never charge for the trade forms themselves.

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
