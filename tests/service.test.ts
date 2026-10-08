import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BargoError, type BargoResult, fetchTrades } from '@/lib/bargo';
import { readBudget } from '@/lib/budget';
import { CACHE_TTL_MS, writeCache } from '@/lib/cache';
import { getTrades } from '@/lib/service';
import { setApiKey } from '@/lib/settings';
import { bargoTrade, congressTrade } from './helpers';

vi.mock('@/lib/bargo', async (original) => ({
  ...(await original<typeof import('@/lib/bargo')>()),
  fetchTrades: vi.fn(),
}));

const fetchMock = vi.mocked(fetchTrades);

function result(trades = [bargoTrade()], remaining = 29): BargoResult {
  return {
    trades,
    rate: { requestsLimit: 30, requestsRemaining: remaining, rowsLimit: 100, rowsRemaining: 100 },
  };
}

beforeEach(() => {
  fakeBrowser.reset();
  fetchMock.mockReset();
});

describe('getTrades', () => {
  it('fetches, normalizes and reports the updated budget', async () => {
    fetchMock.mockResolvedValue(result());
    const response = await getTrades('NVDA', 'chart');
    expect(response).toMatchObject({ status: 'ok', ticker: 'NVDA', stale: false, fromNetwork: true });
    expect(response.trades[0]).toMatchObject({ member: 'Nancy Pelosi', type: 'purchase' });
    expect(response.budget).toMatchObject({ requestsRemaining: 29, rowsRemaining: 99 });
    expect(fetchMock).toHaveBeenCalledWith('NVDA', { limit: 5, apiKey: null });
  });

  it('serves a second chart lookup from cache without spending budget', async () => {
    fetchMock.mockResolvedValue(result());
    await getTrades('NVDA', 'chart');
    const again = await getTrades('NVDA', 'chart');
    expect(again).toMatchObject({ status: 'ok', fromNetwork: false, stale: false });
    expect(again.trades).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches an empty result so quiet tickers do not drain the budget', async () => {
    fetchMock.mockResolvedValue(result([]));
    await getTrades('XYZ', 'chart');
    const again = await getTrades('XYZ', 'chart');
    expect(again).toMatchObject({ status: 'ok', trades: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one request between simultaneous lookups', async () => {
    fetchMock.mockResolvedValue(result());
    const [a, b] = await Promise.all([getTrades('NVDA', 'chart'), getTrades('NVDA', 'chart')]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches once the cache is stale', async () => {
    await writeCache('NVDA', [congressTrade()], Date.now() - CACHE_TTL_MS - 1);
    fetchMock.mockResolvedValue(result([bargoTrade(), bargoTrade({ type: 'sale' })]));
    const response = await getTrades('NVDA', 'chart');
    expect(response).toMatchObject({ fromNetwork: true, stale: false });
    expect(response.trades).toHaveLength(2);
  });

  it('always goes to the network for alert checks', async () => {
    await writeCache('NVDA', [congressTrade()]);
    fetchMock.mockResolvedValue(result());
    expect(await getTrades('NVDA', 'alert')).toMatchObject({ fromNetwork: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes the user key through', async () => {
    await setApiKey('  user-key ');
    fetchMock.mockResolvedValue(result());
    await getTrades('NVDA', 'chart');
    expect(fetchMock).toHaveBeenCalledWith('NVDA', { limit: 5, apiKey: 'user-key' });
  });

  describe('when Bargo says the daily limit is reached', () => {
    beforeEach(() => {
      fetchMock.mockRejectedValue(new BargoError('rate_limited', 'limit'));
    });

    it('reports limited and stops asking', async () => {
      expect(await getTrades('NVDA', 'chart')).toMatchObject({
        status: 'limited',
        trades: [],
        fromNetwork: false,
      });
      expect((await readBudget(false)).requestsRemaining).toBe(0);

      expect(await getTrades('AAPL', 'chart')).toMatchObject({ status: 'limited' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to saved results', async () => {
      const fetchedAt = Date.now() - CACHE_TTL_MS - 1;
      await writeCache('NVDA', [congressTrade()], fetchedAt);
      expect(await getTrades('NVDA', 'chart')).toMatchObject({
        status: 'ok',
        stale: true,
        fetchedAt,
        fromNetwork: false,
      });
    });
  });

  it('reports an error, or saved results, when Bargo is unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new BargoError('network', 'offline'));
    expect(await getTrades('NVDA', 'chart')).toMatchObject({ status: 'error', trades: [] });

    await writeCache('AAPL', [congressTrade({ ticker: 'AAPL' })], Date.now() - CACHE_TTL_MS - 1);
    expect(await getTrades('AAPL', 'chart')).toMatchObject({ status: 'ok', stale: true });
    // A failed request is not counted against the budget.
    expect((await readBudget(false)).requestsRemaining).toBe(30);
  });
});
