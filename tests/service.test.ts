import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BargoError, type BargoResult, fetchTrades } from '@/lib/bargo';
import { readBudget } from '@/lib/budget';
import { CACHE_TTL_MS, writeCache } from '@/lib/cache';
import { getTrades } from '@/lib/service';
import { setApiKey } from '@/lib/settings';
import { WorkerError, fetchTickerPayload } from '@/lib/worker';
import { bargoTrade, congressTrade } from './helpers';

vi.mock('@/lib/bargo', async (original) => ({
  ...(await original<typeof import('@/lib/bargo')>()),
  fetchTrades: vi.fn(),
}));

vi.mock('@/lib/worker', async (original) => ({
  ...(await original<typeof import('@/lib/worker')>()),
  fetchTickerPayload: vi.fn(),
}));

const fetchMock = vi.mocked(fetchTrades);
const workerMock = vi.mocked(fetchTickerPayload);

function result(trades = [bargoTrade()], remaining = 29): BargoResult {
  return {
    trades,
    rate: { requestsLimit: 30, requestsRemaining: remaining, rowsLimit: 100, rowsRemaining: 100 },
  };
}

beforeEach(() => {
  fakeBrowser.reset();
  fetchMock.mockReset();
  workerMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
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

describe('getTrades with the Worker feature flag', () => {
  const context = {
    related_bills: [
      {
        id: '119-hr-1',
        title: 'Defense Authorization Act',
        status: 'became_law' as const,
        date: '2026-10-05',
        policy_area: 'Armed Forces and National Security',
        public_law: '119-5',
        url: 'https://www.congress.gov/bill/119th-congress/house-bill/1',
      },
    ],
    exec_orders: [],
  };

  function flagOn() {
    vi.stubEnv('WXT_USE_WORKER', 'true');
    vi.stubEnv('WXT_WORKER_URL', 'https://congress-trades-api.example.workers.dev');
  }

  it('does not touch the Worker when the flag is off', async () => {
    fetchMock.mockResolvedValue(result());
    await getTrades('NVDA', 'chart');
    expect(workerMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the Worker, keeps the legislation, and spends no Bargo lookups', async () => {
    flagOn();
    workerMock.mockResolvedValue({ trades: [bargoTrade()], ...context });
    const response = await getTrades('NVDA', 'chart');
    expect(response).toMatchObject({ status: 'ok', fromNetwork: true, stale: false, context });
    expect(response.trades[0]).toMatchObject({ member: 'Nancy Pelosi', type: 'purchase' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await readBudget(false)).requestsRemaining).toBe(30);
  });

  it('saves the Worker answer, so a second chart lookup is served from cache with the same legislation', async () => {
    flagOn();
    workerMock.mockResolvedValue({ trades: [bargoTrade()], ...context });
    await getTrades('NVDA', 'chart');
    const again = await getTrades('NVDA', 'chart');
    expect(again).toMatchObject({ status: 'ok', fromNetwork: false, context });
    expect(workerMock).toHaveBeenCalledTimes(1);
  });

  it('reports a Worker answer as fresh for alert checks', async () => {
    flagOn();
    await writeCache('NVDA', [congressTrade()]);
    workerMock.mockResolvedValue({ trades: [bargoTrade()], ...context });
    expect(await getTrades('NVDA', 'alert')).toMatchObject({ fromNetwork: true });
    expect(workerMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Bargo when the Worker fails', async () => {
    flagOn();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    workerMock.mockRejectedValue(new WorkerError('network', 'offline'));
    fetchMock.mockResolvedValue(result());
    const response = await getTrades('NVDA', 'chart');
    expect(response).toMatchObject({ status: 'ok', fromNetwork: true });
    expect(response.trades).toHaveLength(1);
    expect(response.context).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('NVDA', { limit: 5, apiKey: null });
    expect((await readBudget(false)).requestsRemaining).toBe(29);
  });

  it('still reports limited, or saved results, when both the Worker and Bargo are unavailable', async () => {
    flagOn();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    workerMock.mockRejectedValue(new WorkerError('bad_response', 'Worker returned 502'));
    fetchMock.mockRejectedValue(new BargoError('rate_limited', 'limit'));
    expect(await getTrades('NVDA', 'chart')).toMatchObject({ status: 'limited', trades: [] });

    await writeCache('AAPL', [congressTrade({ ticker: 'AAPL' })], Date.now() - CACHE_TTL_MS - 1, context);
    expect(await getTrades('AAPL', 'chart')).toMatchObject({ status: 'ok', stale: true, context });
  });
});
