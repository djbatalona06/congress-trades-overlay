import { BargoError, fetchTrades } from './bargo';
import { ROWS_PER_LOOKUP, allowRequest, readBudget, recordExhausted, recordResponse } from './budget';
import { readCache, writeCache } from './cache';
import { getApiKey } from './settings';
import { toCongressTrades } from './trades';
import type { RequestPurpose, TradesResponse } from './types';

// Only collapses simultaneous requests for one ticker (several tabs on the same
// symbol). Losing it when the worker is torn down is harmless.
const inFlight = new Map<string, Promise<TradesResponse>>();

/**
 * Returns trades for a ticker from cache when fresh, otherwise from Bargo if
 * the budget allows. `alert` lookups always go to the network so a background
 * check can see disclosures the cache has not picked up yet.
 */
export function getTrades(ticker: string, purpose: RequestPurpose): Promise<TradesResponse> {
  const key = `${purpose}:${ticker}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = load(ticker, purpose).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

async function load(ticker: string, purpose: RequestPurpose): Promise<TradesResponse> {
  const apiKey = await getApiKey();
  const [cached, budget] = await Promise.all([readCache(ticker), readBudget(apiKey !== null)]);

  const fromCache = (status: TradesResponse['status'], current = budget): TradesResponse => ({
    status: cached ? 'ok' : status,
    ticker,
    trades: cached?.trades ?? [],
    fetchedAt: cached?.fetchedAt ?? null,
    stale: cached ? !cached.fresh : false,
    fromNetwork: false,
    budget: current,
  });

  if (cached?.fresh && purpose === 'chart') return fromCache('ok');
  if (!allowRequest(budget, purpose)) return fromCache('limited');

  try {
    const result = await fetchTrades(ticker, { limit: ROWS_PER_LOOKUP, apiKey });
    const trades = toCongressTrades(result.trades, ticker);
    const fetchedAt = Date.now();
    const [updated] = await Promise.all([
      recordResponse(budget, result.rate, result.trades.length, fetchedAt),
      writeCache(ticker, trades, fetchedAt),
    ]);
    return {
      status: 'ok',
      ticker,
      trades,
      fetchedAt,
      stale: false,
      fromNetwork: true,
      budget: updated,
    };
  } catch (error) {
    if (error instanceof BargoError && error.kind === 'rate_limited') {
      return fromCache('limited', await recordExhausted(budget));
    }
    console.warn('[congress-trades] lookup failed', error);
    return fromCache('error');
  }
}
