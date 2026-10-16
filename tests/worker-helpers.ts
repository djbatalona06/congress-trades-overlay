import type { BillRow } from '../worker/src/bills';
import type { IeSpendRow } from '../worker/src/fec';
import type { LobbyingRow } from '../worker/src/lda';
import type { MemberLink, Store, StoredOrder, TradeCacheEntry } from '../worker/src/types';
import type { IeSpend, LobbyFiling, RelatedBill, TaxFlag } from '@/lib/types';

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

  ieSpend: (IeSpend)[] = [];
  /** Tax flags with the reviewed state the SQL checks. */
  taxFlags: (TaxFlag & { reviewed: boolean })[] = [];

  /** Rows written by the ingest, keyed by id, and what the read side serves. */
  ieRows = new Map<string, IeSpendRow>();
  lobbyRows = new Map<string, LobbyingRow>();
  links: (MemberLink & { synced_at: number | null })[] = [];
  /** Slugs the saved trade rows would hold. */
  tradeMembers: string[] = [];
  lobbying: LobbyFiling[] = [];

  async upsertIeSpend(rows: IeSpendRow[]) {
    for (const row of rows) this.ieRows.set(row.id, row);
    this.ieSpend = [...this.ieRows.values()];
  }

  async upsertLobbying(rows: LobbyingRow[]) {
    for (const row of rows) this.lobbyRows.set(row.id, row);
  }

  async lobbyingFor(codes: readonly string[], sinceDay: string, limit: number) {
    const fromIngest = [...this.lobbyRows.values()]
      .filter((r) => r.posted_date >= sinceDay && r.issue_codes.some((c) => codes.includes(c)))
      .map((r): LobbyFiling => ({ registrant: r.registrant, client: r.client, issue_codes: [...r.issue_codes].sort(), amount: r.amount, period: r.period, date: r.posted_date, url: r.url }));
    return [...fromIngest, ...this.lobbying.filter((l) => l.date >= sinceDay)]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async upsertMemberLinks(rows: MemberLink[]) {
    for (const row of rows) {
      const found = this.links.find((l) => l.member_slug === row.member_slug && l.fec_candidate_id === row.fec_candidate_id);
      if (found) Object.assign(found, row);
      else this.links.push({ ...row, synced_at: null });
    }
  }

  async membersDueForSync(limit: number) {
    return [...this.links]
      .sort((a, b) => (a.synced_at ?? -1) - (b.synced_at ?? -1) || a.member_slug.localeCompare(b.member_slug))
      .slice(0, limit)
      .map(({ synced_at: _s, ...link }) => link);
  }

  async markMemberSynced(link: Pick<MemberLink, 'member_slug' | 'fec_candidate_id'>, at: number) {
    const found = this.links.find((l) => l.member_slug === link.member_slug && l.fec_candidate_id === link.fec_candidate_id);
    if (found) found.synced_at = at;
  }

  async distinctCommittees() {
    const seen = new Map<string, string>();
    for (const row of this.ieSpend) seen.set(row.committee_id, row.committee_name);
    return [...seen].map(([committee_id, committee_name]) => ({ committee_id, committee_name }));
  }

  async distinctTradeMembers() {
    return this.tradeMembers;
  }

  async allMemberLinks() {
    return this.links.map(({ synced_at: _s, ...link }) => link);
  }

  async ieSpendForMembers(slugs: readonly string[], sinceDay: string, limit: number) {
    return this.ieSpend
      .filter((row) => slugs.includes(row.member_slug) && row.date >= sinceDay)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async reviewedTaxFlags(billIds: readonly string[]) {
    return this.taxFlags
      .filter((flag) => flag.reviewed && billIds.includes(flag.bill_id))
      .map(({ reviewed: _reviewed, ...flag }) => flag);
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
