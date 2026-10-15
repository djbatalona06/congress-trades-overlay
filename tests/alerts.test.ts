import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { alertText, findNewTrades, heatText, pollAlerts, turnedHot } from '@/lib/alerts';
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

// Three different members buying around now: Cluster buy (3) + Fresh filing (1), and both
// parties (2), so the level is Hot. Dates are counted from the real clock because pollAlerts reads it.
const realDay = (back: number) => new Date(Date.now() - back * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
function hotTrades(): CongressTrade[] {
  return ['d1', 'r1', 'd2'].map((slug, index) =>
    congressTrade({
      id: `hot-${slug}`,
      member: `Member ${slug}`,
      memberSlug: slug,
      party: slug.startsWith('r') ? 'R' : 'D',
      transactionDate: realDay(10 + index),
      filedDate: realDay(2),
    }),
  );
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

describe('turnedHot', () => {
  it('is true only when a known level climbs into hot', () => {
    expect(turnedHot('quiet', 'hot')).toBe(true);
    expect(turnedHot('watch', 'hot')).toBe(true);
    expect(turnedHot('hot', 'hot')).toBe(false);
    expect(turnedHot('quiet', 'watch')).toBe(false);
    expect(turnedHot(undefined, 'hot')).toBe(false);
  });
});

describe('heatText', () => {
  it('uses the strongest reason', () => {
    expect(heatText('NVDA', '3 different members bought within 30 days of each other.')).toEqual({
      title: 'NVDA turned Hot',
      message: '3 different members bought within 30 days of each other.',
    });
  });

  it('adds the newest filing when one arrived at the same time', () => {
    expect(heatText('NVDA', 'Reason.', NEW, 2).message).toBe(
      'Reason. Newest: Ro Khanna · Sell · $15,001 - $50,000 (+2 more)',
    );
  });

  it('still says something with no reason', () => {
    expect(heatText('NVDA', null).message).toBe('Congress activity picked up.');
  });
});

describe('pollAlerts: turning Hot', () => {
  it('is silent on the first check, then notifies once when the level jumps to Hot', async () => {
    await addToWatchlist('NVDA', null);

    getTradesMock.mockResolvedValue(fromNetwork('NVDA', hotTrades()));
    await pollAlerts();
    // Already Hot at the first look: that is the baseline, not news.
    expect(notifications()).toHaveLength(0);

    await pollAlerts();
    expect(notifications()).toHaveLength(0);
  });

  it('notifies when a quiet ticker becomes Hot, and not again while it stays Hot', async () => {
    await addToWatchlist('NVDA', null);

    getTradesMock.mockResolvedValue(fromNetwork('NVDA', [OLD]));
    await pollAlerts();
    expect(notifications()).toHaveLength(0);

    getTradesMock.mockResolvedValue(fromNetwork('NVDA', [...hotTrades(), OLD]));
    await pollAlerts();
    const shown = notifications();
    expect(shown).toHaveLength(1);
    // The three new filings arrived with the jump, so there is one combined notification.
    expect(shown[0]).toMatchObject({ title: 'NVDA turned Hot' });
    expect((shown[0] as { message: string }).message).toContain('different members bought');
    expect((shown[0] as { message: string }).message).toContain('(+2 more)');

    await pollAlerts();
    expect(notifications()).toHaveLength(1);
  });

  it('does not tell the free plan', async () => {
    await writeProStatus(false);
    await addToWatchlist('NVDA', null);
    getTradesMock.mockResolvedValue(fromNetwork('NVDA', hotTrades()));
    await pollAlerts();
    expect(getTradesMock).not.toHaveBeenCalled();
    expect(notifications()).toHaveLength(0);
  });

  it('forgets a ticker that left the watchlist, so coming back sets a fresh baseline', async () => {
    await addToWatchlist('NVDA', null);
    getTradesMock.mockResolvedValue(fromNetwork('NVDA', [OLD]));
    await pollAlerts();

    await fakeBrowser.storage.local.clear();
    await writeProStatus(true);
    await addToWatchlist('AAPL', null);
    getTradesMock.mockResolvedValue(fromNetwork('AAPL', hotTrades()));
    await pollAlerts();
    expect(notifications()).toHaveLength(0);
  });
});
