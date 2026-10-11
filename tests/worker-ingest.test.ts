import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncBills, syncOrders } from '../worker/src/ingest';
import { FakeStore } from './worker-helpers';

const NOW = Date.parse('2026-10-10T12:00:00Z');

function listItem(number: number, text: string, overrides: Record<string, unknown> = {}) {
  return {
    congress: 119,
    type: 'HR',
    number: String(number),
    title: `Bill ${number}`,
    latestAction: { actionDate: '2026-10-09', text },
    ...overrides,
  };
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

let store: FakeStore;

beforeEach(() => {
  store = new FakeStore();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('syncBills', () => {
  it('saves bills that moved, skips introduced ones, and fills in the policy area', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/bill?')) {
        return ok({
          bills: [
            listItem(1, 'Became Public Law No: 119-5.'),
            listItem(2, 'Introduced in House'),
            listItem(3, 'Passed Senate with an amendment by Voice Vote.'),
          ],
        });
      }
      return ok({ bill: { policyArea: { name: url.includes('/hr/1?') ? 'Energy' : 'Health' } } });
    }) as unknown as typeof fetch;

    expect(await syncBills(store, 'secret-key', NOW, fetchFn)).toEqual({ saved: 2, looked_up: 2 });
    expect([...store.bills.keys()].sort()).toEqual(['119-hr-1', '119-hr-3']);
    expect(store.bills.get('119-hr-1')?.policyArea).toBe('Energy');
    expect(store.bills.get('119-hr-3')?.policyArea).toBe('Health');
  });

  it('sends the key as a header, never in the URL, and asks for updates since the last run', async () => {
    const fetchFn = vi.fn(async () => ok({ bills: [] }));
    await syncBills(store, 'secret-key', NOW, fetchFn as unknown as typeof fetch);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('secret-key');
    expect(url).not.toContain('api_key');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('secret-key');
    // First run looks back 14 days.
    expect(url).toContain('fromDateTime=2026-09-26T12%3A00%3A00Z');
    expect(url).toContain('sort=updateDate+desc');

    // Second run starts 15 minutes before the first one began.
    await syncBills(store, 'secret-key', NOW + 3600_000, fetchFn as unknown as typeof fetch);
    const second = (fetchFn.mock.calls[1] as unknown as [string])[0];
    expect(second).toContain('fromDateTime=2026-10-10T11%3A45%3A00Z');
  });

  it('keeps reading pages while they come back full', async () => {
    const page = (start: number) => ({ bills: Array.from({ length: 250 }, (_, i) => listItem(start + i, 'Passed House')) });
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('offset=0')) return ok(page(1));
      if (url.includes('offset=250')) return ok(page(1001));
      if (url.includes('/bill?')) return ok({ bills: [] });
      return ok({ bill: {} });
    }) as unknown as typeof fetch;
    const result = await syncBills(store, 'k', NOW, fetchFn);
    expect(result.saved).toBe(500);
    // 3 list calls (the third was empty) + at most 40 detail lookups.
    expect(vi.mocked(fetchFn).mock.calls.length).toBe(3 + 40);
    expect(result.looked_up).toBe(40);
  });

  it('does not move the since marker when the list call fails, and throws without leaking the key', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 429 })) as unknown as typeof fetch;
    await expect(syncBills(store, 'secret-key', NOW, fetchFn)).rejects.toThrow('api.congress.gov answered 429');
    expect(store.state.size).toBe(0);
  });

  it('leaves a bill without a policy area when its lookup fails, to retry next run', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/bill?') ? ok({ bills: [listItem(1, 'Passed House')] }) : new Response('err', { status: 500 }),
    ) as unknown as typeof fetch;
    expect(await syncBills(store, 'k', NOW, fetchFn)).toEqual({ saved: 1, looked_up: 0 });
    expect(store.bills.get('119-hr-1')?.policyArea).toBeNull();
  });

  it('keeps a bill’s policy area when a later action updates it', async () => {
    const respond = (text: string) =>
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('/bill?')
          ? ok({ bills: [listItem(1, text)] })
          : ok({ bill: { policyArea: { name: 'Energy' } } }),
      ) as unknown as typeof fetch;
    await syncBills(store, 'k', NOW, respond('Passed House'));
    await syncBills(store, 'k', NOW + 1, respond('Became Public Law No: 119-9.'));
    expect(store.bills.get('119-hr-1')).toMatchObject({ status: 'became_law', policyArea: 'Energy' });
  });
});

describe('syncOrders', () => {
  it('asks the Federal Register for recent executive orders and saves them', async () => {
    const fetchFn = vi.fn(async () =>
      ok({
        results: [
          {
            document_number: '2026-0001',
            title: 'Strengthening Defense Shipbuilding',
            executive_order_number: 14999,
            signing_date: '2026-10-03',
            publication_date: '2026-10-06',
            html_url: 'https://www.federalregister.gov/d/2026-0001',
            abstract: null,
          },
          { document_number: 'broken' },
        ],
      }),
    );
    expect(await syncOrders(store, NOW, fetchFn as unknown as typeof fetch)).toEqual({ saved: 1 });
    expect([...store.orders.keys()]).toEqual(['2026-0001']);

    const url = decodeURIComponent((fetchFn.mock.calls[0] as unknown as [string])[0]);
    expect(url).toContain('conditions[presidential_document_type][]=executive_order');
    expect(url).toContain('conditions[publication_date][gte]=2026-07-12');
    expect(url).toContain('fields[]=signing_date');
  });

  it('throws when the register is unavailable', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await expect(syncOrders(store, NOW, fetchFn)).rejects.toThrow('503');
  });
});
