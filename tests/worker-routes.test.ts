import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRADE_CACHE_MS, handleRequest } from '../worker/src/routes';
import type { TickerPayload } from '@/lib/types';
import { bargoTrade } from './helpers';
import { FakeStore, billRow, orderRow } from './worker-helpers';

const NOW = Date.parse('2026-10-10T12:00:00Z');

let store: FakeStore;
let loadTrades: ReturnType<typeof vi.fn<(ticker: string) => Promise<ReturnType<typeof bargoTrade>[]>>>;

function get(path: string, init?: RequestInit) {
  return handleRequest(new Request(`https://api.example${path}`, init), { store, now: NOW, loadTrades });
}

beforeEach(() => {
  store = new FakeStore();
  loadTrades = vi.fn(async () => [bargoTrade()]);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('GET /v1/ticker/{T}', () => {
  it('returns trades, related bills and executive orders', async () => {
    await store.upsertBills([billRow()]);
    await store.setPolicyArea('119-hr-1', 'Armed Forces and National Security');
    await store.upsertOrders([orderRow()]);

    const response = await get('/v1/ticker/LMT');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as TickerPayload;
    expect(Object.keys(body).sort()).toEqual(['exec_orders', 'related_bills', 'trades']);
    expect(body.trades).toHaveLength(1);
    expect(body.related_bills).toEqual([
      {
        id: '119-hr-1',
        title: 'Defense Authorization Act',
        status: 'became_law',
        date: '2026-10-05',
        policy_area: 'Armed Forces and National Security',
        public_law: '119-5',
        url: 'https://www.congress.gov/bill/119th-congress/house-bill/1',
      },
    ]);
    expect(body.exec_orders).toEqual([
      {
        document_number: '2026-0001',
        number: 14999,
        title: 'Strengthening Defense Shipbuilding',
        signing_date: '2026-10-03',
        publication_date: '2026-10-06',
        url: 'https://www.federalregister.gov/d/2026-0001',
      },
    ]);
  });

  it('accepts lower case', async () => {
    expect((await get('/v1/ticker/lmt')).status).toBe(200);
    expect(loadTrades).toHaveBeenCalledWith('LMT');
  });

  it('only returns bills from the ticker’s sector and inside the window', async () => {
    await store.upsertBills([
      billRow({ id: 'a', actionDate: '2026-10-05' }),
      billRow({ id: 'b', actionDate: '2026-10-05' }),
      billRow({ id: 'old', actionDate: '2026-06-01' }),
    ]);
    await store.setPolicyArea('a', 'Armed Forces and National Security');
    await store.setPolicyArea('b', 'Health');
    await store.setPolicyArea('old', 'Armed Forces and National Security');

    const ids = async (path: string) => ((await (await get(path)).json()) as TickerPayload).related_bills.map((b) => b.id);
    expect(await ids('/v1/ticker/LMT')).toEqual(['a']);
    expect(await ids('/v1/ticker/LMT?days=365')).toEqual(['a', 'old']);
    expect(await ids('/v1/ticker/PFE')).toEqual(['b']);
  });

  it('keeps only orders that touch the sector, without exposing the abstract', async () => {
    await store.upsertOrders([
      orderRow(),
      orderRow({ document_number: '2026-0002', title: 'Regarding School Lunches', abstract: 'Food programs.' }),
    ]);
    const body = (await (await get('/v1/ticker/LMT')).json()) as TickerPayload;
    expect(body.exec_orders.map((o) => o.document_number)).toEqual(['2026-0001']);
    expect(body.exec_orders[0]).not.toHaveProperty('abstract');
  });

  it('returns trades only for a ticker whose sector is unknown', async () => {
    await store.upsertOrders([orderRow()]);
    const body = (await (await get('/v1/ticker/ZZZZ')).json()) as TickerPayload;
    expect(body.trades).toHaveLength(1);
    expect(body.related_bills).toEqual([]);
    expect(body.exec_orders).toEqual([]);
  });

  it('caps the lists at ten', async () => {
    await store.upsertBills(Array.from({ length: 14 }, (_, i) => billRow({ id: `b${String(i).padStart(2, '0')}` })));
    for (const id of [...store.bills.keys()]) await store.setPolicyArea(id, 'Energy');
    const body = (await (await get('/v1/ticker/XOM')).json()) as TickerPayload;
    expect(body.related_bills).toHaveLength(10);
  });

  it('falls back to 30 days for a nonsense days value and clamps small ones to 1', async () => {
    await store.upsertBills([billRow({ actionDate: '2026-10-05' })]);
    await store.setPolicyArea('119-hr-1', 'Armed Forces and National Security');
    const count = async (days: string) =>
      ((await (await get(`/v1/ticker/LMT?days=${days}`)).json()) as TickerPayload).related_bills.length;
    expect(await count('abc')).toBe(1);
    expect(await count('-5')).toBe(0);
    expect(await count('0')).toBe(0);
    expect(await count('5')).toBe(1);
  });
});

describe('request checks', () => {
  it.each([
    ['/', 404],
    ['/v1/ticker', 404],
    ['/v1/ticker/NVDA/extra', 404],
    ['/v1/ticker/TOOLONGTICKER', 400],
    ['/v1/ticker/12345', 400],
    ['/v1/ticker/%E0%A4%A', 400],
  ])('answers %s with %i', async (path, status) => {
    expect((await get(path)).status).toBe(status);
    expect(loadTrades).not.toHaveBeenCalled();
  });

  it('only allows GET', async () => {
    const response = await get('/v1/ticker/NVDA', { method: 'POST' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('never stores or echoes anything about the caller', async () => {
    const response = await get('/v1/ticker/NVDA', {
      headers: { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '203.0.113.9', cookie: 'a=b' },
    });
    expect(await response.text()).not.toContain('203.0.113.9');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(JSON.stringify([...store.tradeCache])).not.toContain('203.0.113.9');
    expect([...store.state]).toEqual([]);
  });
});

describe('trade cache', () => {
  it('serves a fresh cache without calling upstream', async () => {
    store.tradeCache.set('NVDA', { fetchedAt: NOW - 1000, rows: [bargoTrade({ member: 'Cached Member' })] });
    const body = (await (await get('/v1/ticker/NVDA')).json()) as TickerPayload;
    expect(body.trades[0]?.member).toBe('Cached Member');
    expect(loadTrades).not.toHaveBeenCalled();
  });

  it('refetches and saves once the cache is older than six hours', async () => {
    store.tradeCache.set('NVDA', { fetchedAt: NOW - TRADE_CACHE_MS - 1, rows: [] });
    await get('/v1/ticker/NVDA');
    expect(loadTrades).toHaveBeenCalledTimes(1);
    expect(store.tradeCache.get('NVDA')).toMatchObject({ fetchedAt: NOW, rows: [expect.objectContaining({ member: 'Nancy Pelosi' })] });
  });

  it('serves stale rows when upstream fails', async () => {
    store.tradeCache.set('NVDA', { fetchedAt: NOW - TRADE_CACHE_MS - 1, rows: [bargoTrade({ member: 'Old Member' })] });
    loadTrades.mockRejectedValue(new Error('rate limited'));
    const response = await get('/v1/ticker/NVDA');
    expect(response.status).toBe(200);
    expect(((await response.json()) as TickerPayload).trades[0]?.member).toBe('Old Member');
  });

  it('answers 502 when upstream fails and nothing is saved, so the extension can fall back', async () => {
    loadTrades.mockRejectedValue(new Error('down'));
    const response = await get('/v1/ticker/NVDA');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });
});
