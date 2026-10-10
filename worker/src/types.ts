import type { BargoTrade, ExecOrder, RelatedBill } from '../../lib/types';
import type { BillRow } from './bills';

export type StoredOrder = ExecOrder & { abstract: string };

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

  getState(key: string): Promise<string | null>;
  setState(key: string, value: string): Promise<void>;

  getTradeCache(ticker: string): Promise<TradeCacheEntry | null>;
  putTradeCache(ticker: string, entry: TradeCacheEntry): Promise<void>;
}
