import type { CongressTrade, TickerContext, TradeType } from './types';

/**
 * Simple, explainable "activity" signals worked out on the device from trades
 * the panel already has. Nothing here calls the network, and nothing is advice.
 */
export type SignalLevel = 'quiet' | 'watch' | 'hot';

export type SignalId =
  | 'cluster-buy'
  | 'cluster-sell'
  | 'both-parties'
  | 'big-trade'
  | 'fresh-filing'
  | 'filed-late'
  | 'policy-nearby'
  | 'tax-break'
  | 'outside-money'
  | 'lobbying';

export interface SignalChip {
  id: SignalId;
  label: string;
  /** One plain sentence saying why the chip is lit. */
  detail: string;
  /** Points added to the score. Zero means the chip is information only. */
  points: number;
  /** The trades behind the chip, so the UI can point at them. */
  tradeIds: string[];
}

export interface SignalSummary {
  level: SignalLevel;
  score: number;
  chips: SignalChip[];
}

// Tuning knobs. tests/signals.test.ts pins each one down.
export const RECENT_DAYS = 90; // only trades disclosed this recently count
export const WINDOW_DAYS = 30; // "around the same time" for clusters and policy
export const CLUSTER_MEMBERS = 3;
export const BIG_TRADE_OVER = 250_000; // the filed range must go above this
export const FRESH_DAYS = 7;
export const LATE_DAYS = 45; // the STOCK Act filing deadline
export const WATCH_SCORE = 2;
export const HOT_SCORE = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}/;

/** Whole UTC days since 1970 for a "YYYY-MM-DD…" string, or null when it is not a real day. */
function dayNumber(value: string | null | undefined): number | null {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const time = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(time) ? null : Math.floor(time / DAY_MS);
}

/**
 * Biggest dollar figure in a filed range: "$1,001 - $15,000" -> 15000,
 * "Over $50,000,000" -> 50000000. Null when no amount can be read.
 */
export function topOfRange(amount: string): number | null {
  const figures = [...amount.replace(/,/g, '').matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map((match) =>
    Number(match[1]),
  );
  return figures.length > 0 ? Math.max(...figures) : null;
}

interface Dated {
  trade: CongressTrade;
  /** When the trade was made, falling back to when it was filed. */
  made: number;
  /** When the public could first see it. */
  filed: number;
}

/** Trades with usable dates that were disclosed within `RECENT_DAYS`. Anything undated is left out, never guessed. */
function recentTrades(trades: readonly CongressTrade[], today: number): Dated[] {
  const result: Dated[] = [];
  for (const trade of trades) {
    const made = dayNumber(trade.transactionDate) ?? dayNumber(trade.filedDate);
    const filed = dayNumber(trade.filedDate) ?? dayNumber(trade.transactionDate);
    if (made === null || filed === null) continue;
    if (today - filed > RECENT_DAYS || filed > today) continue;
    result.push({ trade, made, filed });
  }
  return result;
}

/**
 * The busiest stretch of `WINDOW_DAYS` among `items`, judged by how many
 * different keys it holds. Ties go to the later stretch.
 */
function busiestWindow(items: readonly Dated[], keyOf: (item: Dated) => string | null): Dated[] {
  const sorted = [...items].sort((a, b) => a.made - b.made);
  let best: Dated[] = [];
  let bestKeys = 0;
  for (const start of sorted) {
    const inside = sorted.filter(
      (item) => item.made >= start.made && item.made - start.made <= WINDOW_DAYS,
    );
    const keys = new Set(inside.map(keyOf).filter((key): key is string => key !== null)).size;
    if (keys > 0 && keys >= bestKeys) {
      best = inside;
      bestKeys = keys;
    }
  }
  return best;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function clusterChip(recent: Dated[], type: TradeType): SignalChip | null {
  const sameWay = recent.filter((item) => item.trade.type === type);
  const window = busiestWindow(sameWay, (item) => item.trade.memberSlug || item.trade.member);
  const members = new Set(window.map((item) => item.trade.memberSlug || item.trade.member));
  if (members.size < CLUSTER_MEMBERS) return null;
  const buying = type === 'purchase';
  return {
    id: buying ? 'cluster-buy' : 'cluster-sell',
    label: buying ? 'Cluster buy' : 'Cluster sell',
    detail: `${members.size} different members ${buying ? 'bought' : 'sold'} within ${WINDOW_DAYS} days of each other.`,
    points: 3,
    tradeIds: window.map((item) => item.trade.id),
  };
}

function bothPartiesChip(recent: Dated[]): SignalChip | null {
  const buys = recent.filter((item) => item.trade.type === 'purchase' && item.trade.party !== null);
  const window = busiestWindow(buys, (item) => item.trade.party);
  const parties = new Set(window.map((item) => item.trade.party));
  if (!parties.has('D') || !parties.has('R')) return null;
  return {
    id: 'both-parties',
    label: 'Both parties buying',
    detail: `Democrats and Republicans both bought within ${WINDOW_DAYS} days of each other.`,
    points: 2,
    tradeIds: window.map((item) => item.trade.id),
  };
}

function bigTradeChip(recent: Dated[]): SignalChip | null {
  const big = recent.filter((item) => (topOfRange(item.trade.amount) ?? 0) > BIG_TRADE_OVER);
  if (big.length === 0) return null;
  return {
    id: 'big-trade',
    label: 'Big trade',
    detail: `${plural(big.length, 'filing')} with a range going above $${BIG_TRADE_OVER.toLocaleString('en-US')}. Filings give ranges, not exact amounts.`,
    points: 1,
    tradeIds: big.map((item) => item.trade.id),
  };
}

function freshChip(recent: Dated[], today: number): SignalChip | null {
  const fresh = recent.filter((item) => today - item.filed <= FRESH_DAYS);
  if (fresh.length === 0) return null;
  return {
    id: 'fresh-filing',
    label: 'Fresh filing',
    detail: `${plural(fresh.length, 'filing')} made public in the last ${FRESH_DAYS} days.`,
    points: 1,
    tradeIds: fresh.map((item) => item.trade.id),
  };
}

function lateChip(recent: Dated[]): SignalChip | null {
  const late = recent.filter((item) => item.filed - item.made > LATE_DAYS);
  if (late.length === 0) return null;
  return {
    id: 'filed-late',
    label: 'Filed late',
    detail: `${plural(late.length, 'filing')} came in more than ${LATE_DAYS} days after the trade, which is past the legal deadline.`,
    points: 0,
    tradeIds: late.map((item) => item.trade.id),
  };
}

function policyChip(recent: Dated[], context: TickerContext | undefined, today: number): SignalChip | null {
  if (!context) return null;
  const events = [
    ...context.related_bills.map((bill) => dayNumber(bill.date)),
    ...context.exec_orders.map((order) => dayNumber(order.signing_date) ?? dayNumber(order.publication_date)),
  ].filter((day): day is number => day !== null && today - day <= RECENT_DAYS && day <= today);
  const near = recent.filter((item) => events.some((day) => Math.abs(day - item.made) <= WINDOW_DAYS));
  if (near.length === 0) return null;
  return {
    id: 'policy-nearby',
    label: 'Policy nearby',
    detail: `A related bill or executive order moved within ${WINDOW_DAYS} days of ${plural(near.length, 'trade')}.`,
    points: 1,
    tradeIds: near.map((item) => item.trade.id),
  };
}

/** Reviewed tax provisions in bills that became law for this sector. Information only: scores nothing. */
function taxBreakChip(context: TickerContext | undefined): SignalChip | null {
  const lawIds = new Set(context?.related_bills.filter((bill) => bill.status === 'became_law').map((bill) => bill.id));
  const flags = context?.tax_flags?.filter((flag) => lawIds.has(flag.bill_id)) ?? [];
  if (flags.length === 0) return null;
  return {
    id: 'tax-break',
    label: 'Tax break passed in this sector',
    detail: `${plural(flags.length, 'reviewed tax provision')} in a recent law tied to this sector. Each links to the bill.`,
    points: 0,
    tradeIds: [],
  };
}

/** Outside spending reported in the races of members who traded this stock. Information only; says nothing about intent. */
function outsideMoneyChip(trades: readonly CongressTrade[], context: TickerContext | undefined): SignalChip | null {
  const traders = new Set(trades.map((trade) => trade.memberSlug).filter(Boolean));
  const spend = context?.ie_spend?.filter((row) => traders.has(row.member_slug)) ?? [];
  if (spend.length === 0) return null;
  return {
    id: 'outside-money',
    label: 'Outside money in this race',
    detail: `${plural(spend.length, 'spending report')} filed with the FEC in races of members who traded this stock. Reports show what was spent, not why.`,
    points: 0,
    tradeIds: trades.filter((trade) => spend.some((row) => row.member_slug === trade.memberSlug)).map((trade) => trade.id),
  };
}

/** Lobbying filings on issues tied to this sector. Information only: says who hired whom, nothing about outcomes. */
function lobbyingChip(context: TickerContext | undefined): SignalChip | null {
  const count = context?.lobbying?.length ?? 0;
  if (count === 0) return null;
  return {
    id: 'lobbying',
    label: 'Lobbying on this issue',
    detail: `${plural(count, 'recent lobbying filing')} on issues tied to this sector. Filings show who hired whom, not what came of it.`,
    points: 0,
    tradeIds: [],
  };
}

export function levelFor(score: number): SignalLevel {
  if (score >= HOT_SCORE) return 'hot';
  if (score >= WATCH_SCORE) return 'watch';
  return 'quiet';
}

/** Works out the level and the lit chips for one ticker's trades. `now` is a millisecond clock. */
export function computeSignals(
  trades: readonly CongressTrade[],
  context?: TickerContext,
  now: number = Date.now(),
): SignalSummary {
  const today = Math.floor(now / DAY_MS);
  const recent = recentTrades(trades, today);
  const chips = [
    clusterChip(recent, 'purchase'),
    clusterChip(recent, 'sale'),
    bothPartiesChip(recent),
    bigTradeChip(recent),
    freshChip(recent, today),
    policyChip(recent, context, today),
    lateChip(recent),
    taxBreakChip(context),
    outsideMoneyChip(trades, context),
    lobbyingChip(context),
  ].filter((chip): chip is SignalChip => chip !== null);
  const score = chips.reduce((sum, chip) => sum + chip.points, 0);
  return { level: levelFor(score), score, chips };
}

export const LEVEL_LABEL: Record<SignalLevel, string> = {
  quiet: 'Quiet',
  watch: 'Watch',
  hot: 'Hot',
};

/** The sentence for the strongest reason a ticker is lit, or null when nothing scored. */
export function topReason(summary: SignalSummary): string | null {
  const scored = summary.chips.filter((chip) => chip.points > 0);
  scored.sort((a, b) => b.points - a.points);
  return scored[0]?.detail ?? null;
}
