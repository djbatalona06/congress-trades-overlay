import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { isPro, writeProStatus } from '@/lib/pro';
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '@/lib/watchlist';
import { HOUR, NOON } from './helpers';

beforeEach(() => {
  fakeBrowser.reset();
});

async function addAll(...tickers: string[]) {
  for (const ticker of tickers) await addToWatchlist(ticker, null, NOON);
}

describe('watchlist', () => {
  it('starts empty', async () => {
    expect(await getWatchlist()).toEqual([]);
  });

  it('normalizes and stores a ticker with where it was added', async () => {
    const result = await addToWatchlist(' nasdaq:nvda ', 'tradingview', NOON);
    expect(result).toEqual({
      ok: true,
      watchlist: [{ ticker: 'NVDA', addedAt: NOON, platform: 'tradingview' }],
    });
    expect(await getWatchlist()).toEqual(result.watchlist);
  });

  it('stores the issuer when given a bond symbol', async () => {
    await addToWatchlist('FINRA:AAPL4242667', 'tradingview', NOON);
    expect((await getWatchlist())[0]?.ticker).toBe('AAPL');
  });

  it.each(['', 'BTCUSDT', 'not a ticker', 'TSX:T'])('rejects %j', async (input) => {
    expect(await addToWatchlist(input, null, NOON)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('rejects duplicates', async () => {
    await addAll('NVDA');
    expect(await addToWatchlist('nvda', null, NOON)).toMatchObject({ ok: false, reason: 'duplicate' });
  });

  it('stops the free plan at three tickers', async () => {
    await addAll('NVDA', 'AAPL', 'MSFT');
    const result = await addToWatchlist('TSLA', null, NOON);
    expect(result).toMatchObject({ ok: false, reason: 'limit' });
    expect(result.watchlist).toHaveLength(3);
  });

  it('lets Pro go past three', async () => {
    await writeProStatus(true, NOON);
    await addAll('NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN');
    expect(await getWatchlist()).toHaveLength(5);
  });

  it('removes a ticker', async () => {
    await addAll('NVDA', 'AAPL');
    expect((await removeFromWatchlist('NVDA')).map((item) => item.ticker)).toEqual(['AAPL']);
  });
});

describe('isPro', () => {
  it('is false until a paid status is recorded', async () => {
    expect(await isPro(NOON)).toBe(false);
    await writeProStatus(false, NOON);
    expect(await isPro(NOON)).toBe(false);
  });

  it('trusts a paid status for 72 hours after the last successful check', async () => {
    await writeProStatus(true, NOON);
    expect(await isPro(NOON + 71 * HOUR)).toBe(true);
    expect(await isPro(NOON + 72 * HOUR)).toBe(false);
  });
});
