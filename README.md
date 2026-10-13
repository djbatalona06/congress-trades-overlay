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
3. Look in the bottom corner. Click the box to open it.
4. Click the star to watch a stock. You can get a message when someone in Congress trades it.

## Is it safe?

Yes. Capitol Tape only reads the stock's name from the web page. It cannot see your money. It cannot buy or sell anything for you. It does not know who you are.

## Does it cost money?

- **Free:** you get the box on all four websites. You can watch 3 tickers (a ticker is a stock's short name, like NVDA).
- **Pro ($8/month):** you can watch as many stocks as you want. You also get a message when there is a new form.

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
