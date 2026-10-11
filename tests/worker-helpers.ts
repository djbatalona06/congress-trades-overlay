import type { BillRow } from '../worker/src/bills';
import type { Store, StoredOrder, TradeCacheEntry } from '../worker/src/types';
import type { RelatedBill } from '@/lib/types';

/** In-memory stand-in for the D1 store, same filtering rules as the SQL. */
export class FakeStore implements Store {
  bills = new Map<string, BillRow & { policyArea: string | null }>();
  orders = new Map<string, StoredOrder>();
  state = new Map<string, string>();
  tradeCache = new Map<string, TradeCacheEntry>();

  async upsertBills(rows: BillRow[]) {
    for (const row of rows) {
      this.bills.set(row.id, { ...row, policyArea: this.bills.get(row.id)?.policyArea ?? null });
    }
  }

  async billsMissingPolicyArea(limit: number) {
    return [...this.bills.values()]
      .filter((bill) => bill.policyArea === null)
      .sort((a, b) => b.actionDate.localeCompare(a.actionDate))
      .slice(0, limit);
  }

  async setPolicyArea(id: string, policyArea: string) {
    const bill = this.bills.get(id);
    if (bill) bill.policyArea = policyArea;
  }

  async relatedBills(areas: readonly string[], sinceDay: string, limit: number): Promise<RelatedBill[]> {
    return [...this.bills.values()]
      .filter((b) => b.policyArea !== null && areas.includes(b.policyArea) && b.actionDate >= sinceDay)
      .sort((a, b) => b.actionDate.localeCompare(a.actionDate) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((b) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        date: b.actionDate,
        policy_area: b.policyArea ?? '',
        public_law: b.publicLaw,
        url: b.url,
      }));
  }

  async upsertOrders(rows: StoredOrder[]) {
    for (const row of rows) this.orders.set(row.document_number, row);
  }

  async recentOrders(sinceDay: string) {
    return [...this.orders.values()]
      .filter((o) => (o.signing_date ?? o.publication_date) >= sinceDay)
      .sort((a, b) => (b.signing_date ?? b.publication_date).localeCompare(a.signing_date ?? a.publication_date));
  }

  async getState(key: string) {
    return this.state.get(key) ?? null;
  }

  async setState(key: string, value: string) {
    this.state.set(key, value);
  }

  async getTradeCache(ticker: string) {
    return this.tradeCache.get(ticker) ?? null;
  }

  async putTradeCache(ticker: string, entry: TradeCacheEntry) {
    this.tradeCache.set(ticker, entry);
  }
}

export function billRow(overrides: Partial<BillRow> = {}): BillRow {
  return {
    id: '119-hr-1',
    congress: 119,
    type: 'HR',
    number: '1',
    title: 'Defense Authorization Act',
    status: 'became_law',
    actionDate: '2026-10-05',
    actionText: 'Became Public Law No: 119-5.',
    publicLaw: '119-5',
    url: 'https://www.congress.gov/bill/119th-congress/house-bill/1',
    ...overrides,
  };
}

export function orderRow(overrides: Partial<StoredOrder> = {}): StoredOrder {
  return {
    document_number: '2026-0001',
    number: 14999,
    title: 'Strengthening Defense Shipbuilding',
    abstract: 'Rebuilding the defense industrial base.',
    signing_date: '2026-10-03',
    publication_date: '2026-10-06',
    url: 'https://www.federalregister.gov/d/2026-0001',
    ...overrides,
  };
}
