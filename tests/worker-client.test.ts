import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkerError, fetchTickerPayload, workerBaseUrl, workerEnabled } from '@/lib/worker';
import { bargoTrade } from './helpers';

const BASE = 'https://congress-trades-api.example.workers.dev';

const bill = {
  id: '119-hr-1',
  title: 'Defense Authorization Act',
  status: 'became_law',
  date: '2026-10-05',
  policy_area: 'Armed Forces and National Security',
  public_law: '119-5',
  url: 'https://www.congress.gov/bill/119th-congress/house-bill/1',
};
const order = {
  document_number: '2026-0001',
  number: 14999,
  title: 'Strengthening Defense Shipbuilding',
  signing_date: '2026-10-03',
  publication_date: '2026-10-06',
  url: 'https://www.federalregister.gov/d/2026-0001',
};

function reply(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('feature flag', () => {
  it('is off unless the build turns it on with an https address', () => {
    expect(workerEnabled()).toBe(false);

    vi.stubEnv('WXT_WORKER_URL', BASE);
    expect(workerEnabled()).toBe(false);

    vi.stubEnv('WXT_USE_WORKER', 'false');
    expect(workerEnabled()).toBe(false);

    vi.stubEnv('WXT_USE_WORKER', 'true');
    expect(workerEnabled()).toBe(true);
    expect(workerBaseUrl()).toBe(BASE);
  });

  it('refuses an address that is not https, and trims a trailing slash', () => {
    vi.stubEnv('WXT_USE_WORKER', 'true');
    vi.stubEnv('WXT_WORKER_URL', 'http://localhost:8787');
    expect(workerEnabled()).toBe(false);

    vi.stubEnv('WXT_WORKER_URL', ` ${BASE}/ `);
    expect(workerBaseUrl()).toBe(BASE);
  });
});

describe('fetchTickerPayload', () => {
  it('sends only the ticker: no cookies, no key, no extra headers', async () => {
    const fetchMock = reply({ trades: [bargoTrade()], related_bills: [bill], exec_orders: [order] });
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchTickerPayload('BRK.B', BASE);
    expect(payload.trades).toHaveLength(1);
    expect(payload.related_bills).toEqual([bill]);
    expect(payload.exec_orders).toEqual([order]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/ticker/BRK.B`);
    expect(init.credentials).toBe('omit');
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('drops malformed bills and orders, and links that are not https', async () => {
    vi.stubGlobal(
      'fetch',
      reply({
        trades: [],
        related_bills: [bill, { ...bill, id: '' }, { ...bill, url: 'javascript:alert(1)' }, 'junk', null],
        exec_orders: [order, { ...order, url: 'http://example.com' }, { title: 'no id' }],
      }),
    );
    const payload = await fetchTickerPayload('LMT', BASE);
    expect(payload.related_bills.map((b) => b.id)).toEqual(['119-hr-1']);
    expect(payload.exec_orders.map((o) => o.document_number)).toEqual(['2026-0001']);
  });

  it('treats missing lists as empty', async () => {
    vi.stubGlobal('fetch', reply({ trades: [] }));
    expect(await fetchTickerPayload('LMT', BASE)).toEqual({ trades: [], related_bills: [], exec_orders: [] });
  });

  it('fails with a WorkerError the caller can fall back on', async () => {
    const fails = async (setup: () => void, kind: string) => {
      setup();
      const error = await fetchTickerPayload('LMT', BASE).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(WorkerError);
      expect((error as WorkerError).kind).toBe(kind);
    };
    await fails(() => vi.stubGlobal('fetch', reply({ error: 'unavailable' }, 502)), 'bad_response');
    await fails(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 }))), 'bad_response');
    await fails(() => vi.stubGlobal('fetch', reply({ related_bills: [] })), 'bad_response');
    await fails(() => vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline')))), 'network');
  });

  it('does nothing when the flag is off', async () => {
    const fetchMock = reply({});
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTickerPayload('LMT')).rejects.toBeInstanceOf(WorkerError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
