import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { alertText, findNewTrades, pollAlerts } from '@/lib/alerts';
import { writeProStatus } from '@/lib/pro';
import { getTrades } from '@/lib/service';
import type { CongressTrade, TradesResponse } from '@/lib/types';
import { addToWatchlist } from '@/lib/watchlist';
import { budget, congressTrade } from './helpers';

vi.mock('@/lib/service', () => ({ getTrades: vi.fn() }));

const getTradesMock = vi.mocked(getTrades);

const OLD = congressTrade({ id: 'old' });
const NEW = congressTrade({ id: 'new', member: 'Ro Khanna', type: 'sale', amount: '$15,001 - $50,000' });

function fromNetwork(ticker: string, trades: CongressTrade[]): TradesResponse {
  return {
    status: 'ok',
    ticker,
    trades,
    fetchedAt: Date.now(),
    stale: false,
    fromNetwork: true,
    budget: budget(),
  };
}

let createNotification: ReturnType<typeof vi.spyOn>;

/** Options of every notification shown so far. */
function notifications() {
  return createNotification.mock.calls.map((call: unknown[]) => call[1]);
}

beforeEach(async () => {
  fakeBrowser.reset();
  getTradesMock.mockReset();
  vi.spyOn(fakeBrowser.runtime, 'getURL').mockImplementation((path) => `chrome-extension://id${path}`);
  createNotification = vi.spyOn(fakeBrowser.notifications, 'create');
  await writeProStatus(true);
});

describe('findNewTrades', () => {
  it('treats the first check of a ticker as a baseline', () => {
    expect(findNewTrades(undefined, [OLD, NEW])).toEqual([]);
  });

  it('returns only unseen trades', () => {
    expect(findNewTrades(['old'], [NEW, OLD])).toEqual([NEW]);
    expect(findNewTrades(['old', 'new'], [NEW, OLD])).toEqual([]);
  });
});

describe('alertText', () => {
  it('describes a single disclosure', () => {
    expect(alertText('NVDA', NEW, 0)).toEqual({
      title: 'New Congress disclosure: NVDA',
      message: 'Ro Khanna · Sell · $15,001 - $50,000',
    });
  });

  it('counts the rest', () => {
    expect(alertText('NVDA', NEW, 2).message).toMatch(/\(\+2 more\)$/);
  });
});

describe('pollAlerts', () => {
  it('does nothing on the free plan', async () => {
    await writeProStatus(false);
    await addToWatchlist('NVDA', null);
    await pollAlerts();
    expect(getTradesMock).not.toHaveBeenCalled();
  });

  it('does nothing with an empty watchlist', async () => {
    await pollAlerts();
    expect(getTradesMock).not.toHaveBeenCalled();
  });

  it('is silent on the first check, then notifies once per new disclosure', async () => {
    await addToWatchlist('NVDA', null);

    getTradesMock.mockResolvedValue(fromNetwork('NVDA', [OLD]));
    await pollAlerts();
    expect(notifications()).toHaveLength(0);

    getTradesMock.mockResolvedValue(fromNetwork('NVDA', [NEW, OLD]));
    await pollAlerts();
    const shown = notifications();
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({
      title: 'New Congress disclosure: NVDA',
      message: 'Ro Khanna · Sell · $15,001 - $50,000',
    });

    await pollAlerts();
    expect(notifications()).toHaveLength(1);
  });

  it('checks one ticker per call, in rotation', async () => {
    await addToWatchlist('NVDA', null);
    await addToWatchlist('AAPL', null);
    getTradesMock.mockImplementation(async (ticker) => fromNetwork(ticker, []));

    await pollAlerts();
    await pollAlerts();
    await pollAlerts();
    expect(getTradesMock.mock.calls.map(([ticker, purpose]) => `${purpose}:${ticker}`)).toEqual([
      'alert:NVDA',
      'alert:AAPL',
      'alert:NVDA',
    ]);
  });

  it('retries the same ticker when the budget refused the request', async () => {
    await addToWatchlist('NVDA', null);
    await addToWatchlist('AAPL', null);
    getTradesMock.mockResolvedValueOnce({ ...fromNetwork('NVDA', [OLD]), fromNetwork: false });
    getTradesMock.mockImplementation(async (ticker) => fromNetwork(ticker, [OLD]));

    await pollAlerts();
    await pollAlerts();
    expect(getTradesMock.mock.calls.map(([ticker]) => ticker)).toEqual(['NVDA', 'NVDA']);
    // The refused call must not have set a baseline from cached data.
    expect(notifications()).toHaveLength(0);
  });
});
