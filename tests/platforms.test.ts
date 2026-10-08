// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { detect } from '@/lib/platforms';

// URL and DOM shapes captured from the live sites on 2026-10-07.
function page(title = '', body = ''): Document {
  document.title = title;
  document.body.innerHTML = body;
  return document;
}

const chartHeader = (symbol: string) =>
  `<button id="header-toolbar-symbol-search">${symbol}</button>`;

beforeEach(() => {
  page();
});

describe('TradingView', () => {
  it('reads the symbol page path', () => {
    const url = new URL('https://www.tradingview.com/symbols/NASDAQ-NVDA/');
    expect(detect(url, page())).toEqual({ platform: 'tradingview', ticker: 'NVDA', bond: null });
  });

  it('reads a share class from the symbol page path', () => {
    const url = new URL('https://www.tradingview.com/symbols/NYSE-BRK.B/');
    expect(detect(url, page())?.ticker).toBe('BRK.B');
  });

  it('reads the chart header', () => {
    const url = new URL('https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA');
    const doc = page('NVDA 237.47 ▼ −0.74%', chartHeader('NVDA'));
    expect(detect(url, doc)?.ticker).toBe('NVDA');
  });

  it('prefers the live chart symbol over a stale ?symbol= param', () => {
    const url = new URL('https://www.tradingview.com/chart/abc123/?symbol=NASDAQ%3ANVDA');
    const doc = page('AAPL 255.10 ▲ +0.31%', chartHeader('AAPL'));
    expect(detect(url, doc)?.ticker).toBe('AAPL');
  });

  it('falls back to the title, then the param, before the header renders', () => {
    const url = new URL('https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA');
    expect(detect(url, page('MSFT 512.00 ▲ +1.10%'))?.ticker).toBe('MSFT');
    expect(detect(url, page('Live stock, index, futures charts'))?.ticker).toBe('NVDA');
  });

  it('resolves a corporate bond to its issuer', () => {
    const symbolPage = new URL('https://www.tradingview.com/symbols/FINRA-AAPL4242667/');
    expect(detect(symbolPage, page())).toEqual({
      platform: 'tradingview',
      ticker: 'AAPL',
      bond: 'AAPL4242667',
    });

    const chart = new URL('https://www.tradingview.com/chart/?symbol=FINRA%3AMO.HA');
    expect(detect(chart, page('MO.HA 131.2', chartHeader('MO.HA')))).toEqual({
      platform: 'tradingview',
      ticker: 'MO',
      bond: 'MO.HA',
    });
  });

  it('ignores non-equity charts and other pages', () => {
    const crypto = new URL('https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT');
    expect(detect(crypto, page('BTCUSDT 61000 ▲', chartHeader('BTCUSDT')))).toBeNull();
    expect(detect(new URL('https://www.tradingview.com/symbols/TVC-US10Y/'), page())).toBeNull();
    expect(detect(new URL('https://www.tradingview.com/markets/'), page())).toBeNull();
  });

  it('works on localized subdomains', () => {
    const url = new URL('https://in.tradingview.com/symbols/NASDAQ-AAPL/');
    expect(detect(url, page())?.ticker).toBe('AAPL');
  });
});

describe('Robinhood', () => {
  it.each(['https://robinhood.com/stocks/NVDA', 'https://robinhood.com/us/en/stocks/NVDA/'])(
    'reads %s',
    (href) => {
      expect(detect(new URL(href), page())).toEqual({
        platform: 'robinhood',
        ticker: 'NVDA',
        bond: null,
      });
    },
  );

  it('ignores crypto and account pages', () => {
    expect(detect(new URL('https://robinhood.com/crypto/BTC'), page())).toBeNull();
    expect(detect(new URL('https://robinhood.com/account'), page())).toBeNull();
  });
});

describe('Webull', () => {
  it('reads venue-prefixed quote paths', () => {
    const url = new URL('https://www.webull.com/quote/nasdaq-nvda');
    expect(detect(url, page())).toEqual({ platform: 'webull', ticker: 'NVDA', bond: null });
  });

  it('restores the dot in share classes', () => {
    expect(detect(new URL('https://www.webull.com/quote/nyse-brk-b'), page())?.ticker).toBe('BRK.B');
  });

  it('ignores crypto quotes and other pages', () => {
    expect(detect(new URL('https://www.webull.com/quote/ccc-btcusd'), page())).toBeNull();
    expect(detect(new URL('https://www.webull.com/quote/us/gainers'), page())).toBeNull();
  });
});

describe('Schwab', () => {
  it('reads the research quote path', () => {
    const url = new URL('https://www.schwab.com/research/stocks/quotes/summary/nvda');
    expect(detect(url, page())).toEqual({ platform: 'schwab', ticker: 'NVDA', bond: null });
  });

  it('reads ETF quotes and the ?symbol= form', () => {
    const etf = new URL('https://www.schwab.com/research/etfs/quotes/summary/spy');
    expect(detect(etf, page())?.ticker).toBe('SPY');
    const param = new URL('https://www.schwab.com/research/stocks/tools?symbol=AAPL');
    expect(detect(param, page())?.ticker).toBe('AAPL');
  });

  it('ignores non-research pages', () => {
    expect(detect(new URL('https://www.schwab.com/brokerage?symbol=AAPL'), page())).toBeNull();
  });
});

describe('unsupported hosts', () => {
  it('returns null', () => {
    expect(detect(new URL('https://example.com/stocks/NVDA'), page())).toBeNull();
    expect(detect(new URL('https://app.webull.com/quote/nasdaq-nvda'), page())).toBeNull();
  });
});
