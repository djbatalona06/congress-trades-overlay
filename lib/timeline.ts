import type { CongressTrade, ExecOrder, RelatedBill } from './types';

export type TimelineEvent =
  | { kind: 'trade'; date: string; id: string; trade: CongressTrade }
  | { kind: 'bill'; date: string; id: string; bill: RelatedBill }
  | { kind: 'order'; date: string; id: string; order: ExecOrder };

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** First usable "YYYY-MM-DD" among the candidates, or null. Time-of-day parts are dropped. */
function pickDay(...candidates: (string | null | undefined)[]): string | null {
  for (const value of candidates) {
    if (value && DAY.test(value)) return value.slice(0, 10);
  }
  return null;
}

// Same-day order: a trade is listed before the law it sits next to, so the
// timeline reads trade, then bill, then order, never the other way round.
const KIND_RANK = { trade: 0, bill: 1, order: 2 } as const;

/**
 * Puts trades, bills and executive orders on one timeline, newest first.
 *
 * Each event sits on the day it actually happened: a trade on the day it was
 * made (falling back to the filing day), a bill on its latest action, an order
 * on its signing day (falling back to publication). Anything without a usable
 * date is left out rather than guessed.
 */
export function mergeTimeline(
  trades: readonly CongressTrade[],
  bills: readonly RelatedBill[],
  orders: readonly ExecOrder[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const trade of trades) {
    const date = pickDay(trade.transactionDate, trade.filedDate);
    if (date) events.push({ kind: 'trade', date, id: trade.id, trade });
  }
  for (const bill of bills) {
    const date = pickDay(bill.date);
    if (date) events.push({ kind: 'bill', date, id: bill.id, bill });
  }
  for (const order of orders) {
    const date = pickDay(order.signing_date, order.publication_date);
    if (date) events.push({ kind: 'order', date, id: order.document_number, order });
  }
  return events.sort(
    (a, b) => b.date.localeCompare(a.date) || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.id.localeCompare(b.id),
  );
}
