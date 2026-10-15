import type { BargoTrade, ExecOrder, IeSpend, LobbyFiling, RelatedBill, TaxFlag } from '../../lib/types';
import type { BillRow } from './bills';
import type { IeSpendRow } from './fec';
import type { LobbyingRow } from './lda';

export type StoredOrder = ExecOrder & { abstract: string };

export interface MemberLink {
  member_slug: string;
  fec_candidate_id: string;
  chamber: 'house' | 'senate';
  state: string;
}

export interface TradeCacheEntry {
  fetchedAt: number;
  rows: BargoTrade[];
}

/** Everything the Worker reads or writes. D1 backs it in production; tests use a map. */
export interface Store {
  upsertBills(rows: BillRow[]): Promise<void>;
  /** Bills that still need their policy area looked up, newest action first. */
  billsMissingPolicyArea(limit: number): Promise<Pick<BillRow, 'id' | 'congress' | 'type' | 'number'>[]>;
  setPolicyArea(id: string, policyArea: string): Promise<void>;
  relatedBills(policyAreas: readonly string[], sinceDay: string, limit: number): Promise<RelatedBill[]>;

  upsertOrders(rows: StoredOrder[]): Promise<void>;
  recentOrders(sinceDay: string): Promise<StoredOrder[]>;

  ieSpendForMembers(memberSlugs: readonly string[], sinceDay: string, limit: number): Promise<IeSpend[]>;
  /** Only flags a person has reviewed, on the given bills. */
  reviewedTaxFlags(billIds: readonly string[]): Promise<TaxFlag[]>;

  upsertIeSpend(rows: IeSpendRow[]): Promise<void>;
  upsertLobbying(rows: LobbyingRow[]): Promise<void>;
  /** Filings listing any of `codes`, newest first. */
  lobbyingFor(codes: readonly string[], sinceDay: string, limit: number): Promise<LobbyFiling[]>;

  /** Adds links; never resets a link's synced time. */
  upsertMemberLinks(rows: MemberLink[]): Promise<void>;
  /** Links whose outside spending was pulled longest ago (never-pulled first). */
  membersDueForSync(limit: number): Promise<MemberLink[]>;
  markMemberSynced(link: Pick<MemberLink, 'member_slug' | 'fec_candidate_id'>, at: number): Promise<void>;
  /** For checks: every stored committee, and every member slug seen in saved trade rows. */
  distinctCommittees(): Promise<{ committee_id: string; committee_name: string }[]>;
  distinctTradeMembers(): Promise<string[]>;
  allMemberLinks(): Promise<MemberLink[]>;

  getState(key: string): Promise<string | null>;
  setState(key: string, value: string): Promise<void>;

  getTradeCache(ticker: string): Promise<TradeCacheEntry | null>;
  putTradeCache(ticker: string, entry: TradeCacheEntry): Promise<void>;
}
