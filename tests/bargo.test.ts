import { describe, expect, it, vi } from 'vitest';
import { BargoError, fetchTrades } from '@/lib/bargo';
import { bargoTrade } from './helpers';

function stubFetch(response: Response | Error) {
  const mock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), init);
}

describe('fetchTrades', () => {
  it('requests the ticker endpoint without a key by default', async () => {
    const fetchMock = stubFetch(json({ trades: [] }));
    await fetchTrades('BRK.B', { limit: 5 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://www.bargo.ai/free-apis/congress/v1/trades/BRK.B?limit=5');
    expect(init?.headers).not.toHaveProperty('X-Api-Key');
  });

  it('sends the user key when one is set', async () => {
    const fetchMock = stubFetch(json({ trades: [] }));
    await fetchTrades('NVDA', { limit: 5, apiKey: 'user-key' });
    expect(fetchMock.mock.calls[0]![1]?.headers).toMatchObject({ 'X-Api-Key': 'user-key' });
  });

  it('returns trades and the rate-limit headers', async () => {
    stubFetch(
      json(
        { trades: [bargoTrade()], page: 0, limit: 5, count: 1 },
        {
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': '28',
            'X-RateLimit-Rows-Limit': '100',
            'X-RateLimit-Rows-Remaining': '97',
          },
        },
      ),
    );
    const result = await fetchTrades('NVDA', { limit: 5 });
    expect(result.trades).toHaveLength(1);
    expect(result.rate).toEqual({
      requestsLimit: 30,
      requestsRemaining: 28,
      rowsLimit: 100,
      rowsRemaining: 97,
    });
  });

  it('reports missing rate-limit headers as null', async () => {
    stubFetch(json({ trades: [] }));
    const { rate } = await fetchTrades('NVDA', { limit: 5 });
    expect(rate.requestsRemaining).toBeNull();
    expect(rate.rowsRemaining).toBeNull();
  });

  it.each([
    [json({ error: 'limit' }, { status: 429 }), 'rate_limited'],
    [json({ error: 'key' }, { status: 401 }), 'invalid_key'],
    [json({ error: 'boom' }, { status: 500 }), 'bad_response'],
    [new Response('<html>', { status: 200 }), 'bad_response'],
    [json({ nope: true }), 'bad_response'],
    [new TypeError('Failed to fetch'), 'network'],
  ])('maps failures to a typed error (%#)', async (response, kind) => {
    stubFetch(response);
    const error = await fetchTrades('NVDA', { limit: 5 }).catch((caught) => caught);
    expect(error).toBeInstanceOf(BargoError);
    expect(error.kind).toBe(kind);
  });
});
