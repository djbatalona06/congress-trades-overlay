export type Platform = 'tradingview' | 'robinhood' | 'webull' | 'schwab';
export type Chamber = 'house' | 'senate';
export type TradeType = 'purchase' | 'sale' | 'exchange';
export type Party = 'D' | 'R' | 'I';

/** A trade exactly as Bargo returns it. */
export interface BargoTrade {
  member: string | null;
  member_slug: string | null;
  chamber: string | null;
  state: string | null;
  ticker: string | null;
  asset: string | null;
  type: string | null;
  amount_low: number | null;
  amount_high: number | null;
  amount_range: string | null;
  transaction_date: string | null;
  disclosure_date: string | null;
  filing_portal?: string | null;
}

export interface CongressTrade {
  id: string;
  member: string;
  memberSlug: string;
  party: Party | null;
  chamber: Chamber | null;
  state: string | null;
  ticker: string;
  type: TradeType | null;
  amount: string;
  transactionDate: string | null;
  filedDate: string | null;
  sourceUrl: string | null;
}

export interface WatchlistItem {
  ticker: string;
  addedAt: number;
  /** Null when the ticker was typed into the popup rather than added from a chart. */
  platform: Platform | null;
}

/** The ticker to look up, plus the bond symbol it was derived from, if any. */
export interface ResolvedTicker {
  ticker: string;
  bond: string | null;
}

export type RequestPurpose = 'chart' | 'alert';

export interface BudgetState {
  /** UTC day (YYYY-MM-DD) these counters belong to. */
  day: string;
  requestsLimit: number;
  requestsRemaining: number;
  rowsLimit: number;
  rowsRemaining: number;
}

export type TradesStatus = 'ok' | 'limited' | 'error';

export interface TradesResponse {
  status: TradesStatus;
  ticker: string;
  trades: CongressTrade[];
  fetchedAt: number | null;
  stale: boolean;
  /** Whether this response cost a Bargo request. */
  fromNetwork: boolean;
  budget: BudgetState;
}

export interface ProStatus {
  paid: boolean;
  checkedAt: number;
}
