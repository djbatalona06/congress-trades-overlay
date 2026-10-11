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

/** How far a bill got. Bills that were only introduced are never returned. */
export type BillStatus = 'passed_chamber' | 'to_president' | 'became_law' | 'vetoed';

/** A bill in Congress.gov's own words, matched to a stock's sector by policy area. */
export interface RelatedBill {
  /** "119-hr-1234" */
  id: string;
  title: string;
  status: BillStatus;
  /** Day (YYYY-MM-DD) of the latest action, which is what `status` describes. */
  date: string;
  policy_area: string;
  /** "119-5" once the bill became a public or private law. */
  public_law: string | null;
  url: string;
}

/** A presidential executive order from the Federal Register. */
export interface ExecOrder {
  document_number: string;
  /** The "Executive Order 14xxx" number; null when the register has not assigned one. */
  number: number | null;
  title: string;
  signing_date: string | null;
  publication_date: string;
  url: string;
}

/** The legislation half of a Worker answer. */
export interface TickerContext {
  related_bills: RelatedBill[];
  exec_orders: ExecOrder[];
}

/** What `GET /v1/ticker/{T}` returns. Trades keep Bargo's row shape. */
export interface TickerPayload extends TickerContext {
  trades: BargoTrade[];
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
  /** True when the data was just fetched (from the Worker or Bargo), false when it is saved results. */
  fromNetwork: boolean;
  budget: BudgetState;
  /** Present when the lookup came from the Worker (or from a saved Worker answer). */
  context?: TickerContext;
}

export interface ProStatus {
  paid: boolean;
  checkedAt: number;
}
