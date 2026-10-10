import { isValidTicker } from '../../lib/ticker';
import type { BargoTrade, ExecOrder, TickerPayload } from '../../lib/types';
import { policyAreasFor, sectorFor, textMatchesSector } from './sectors';
import type { Store } from './types';

export const TRADE_CACHE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MAX_BILLS = 10;
const MAX_ORDERS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Deps {
  store: Store;
  now: number;
  /** Fetches trade rows from the upstream source. Throws when it cannot. */
  loadTrades: (ticker: string) => Promise<BargoTrade[]>;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

/** Rows from the shared cache while fresh, else from upstream; stale rows beat an error. */
async function tradeRows(ticker: string, { store, now, loadTrades }: Deps): Promise<BargoTrade[]> {
  const cached = await store.getTradeCache(ticker);
  if (cached && now - cached.fetchedAt < TRADE_CACHE_MS) return cached.rows;
  try {
    const rows = await loadTrades(ticker);
    await store.putTradeCache(ticker, { fetchedAt: now, rows });
    return rows;
  } catch (error) {
    console.warn('[trades] upstream failed', ticker, String(error));
    if (cached) return cached.rows;
    throw error;
  }
}

function parseDays(raw: string | null): number {
  const days = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(days) ? Math.min(Math.max(days, 1), MAX_DAYS) : DEFAULT_DAYS;
}

export async function handleRequest(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const match = /^\/v1\/ticker\/([^/]+)$/.exec(url.pathname);
  if (!match) return json({ error: 'not_found' }, 404);
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });

  let ticker: string;
  try {
    ticker = decodeURIComponent(match[1] ?? '').toUpperCase();
  } catch {
    return json({ error: 'bad_ticker' }, 400);
  }
  if (!isValidTicker(ticker)) return json({ error: 'bad_ticker' }, 400);

  const sinceDay = new Date(deps.now - parseDays(url.searchParams.get('days')) * DAY_MS).toISOString().slice(0, 10);
  const sector = sectorFor(ticker);

  try {
    const [trades, related_bills, orders] = await Promise.all([
      tradeRows(ticker, deps),
      sector ? deps.store.relatedBills(policyAreasFor(sector), sinceDay, MAX_BILLS) : [],
      sector ? deps.store.recentOrders(sinceDay) : [],
    ]);
    const exec_orders: ExecOrder[] = orders
      .filter((order) => sector && textMatchesSector(sector, `${order.title} ${order.abstract}`))
      .slice(0, MAX_ORDERS)
      .map(({ abstract: _abstract, ...order }) => order);

    const payload: TickerPayload = { trades, related_bills, exec_orders };
    return json(payload, 200, { 'cache-control': 'public, max-age=300' });
  } catch (error) {
    console.warn('[ticker] failed', ticker, String(error));
    return json({ error: 'unavailable' }, 502);
  }
}
