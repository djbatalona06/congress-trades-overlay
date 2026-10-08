import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { isPro } from './pro';
import { getTrades } from './service';
import { TYPE_LABEL } from './trades';
import type { CongressTrade } from './types';
import { getWatchlist } from './watchlist';

export const ALERT_ALARM = 'alerts:poll';
export const ALERT_PERIOD_MINUTES = 60;

const CURSOR = 'local:alertCursor';
const SEEN = 'local:alertSeen';
const MAX_SEEN_PER_TICKER = 50;

type SeenMap = Record<string, string[]>;

/** Trades not seen before. A ticker with no history yields none: its first check only sets the baseline. */
export function findNewTrades(known: string[] | undefined, trades: CongressTrade[]): CongressTrade[] {
  if (!known) return [];
  return trades.filter((trade) => !known.includes(trade.id));
}

export function alertText(
  ticker: string,
  first: CongressTrade,
  others: number,
): { title: string; message: string } {
  const action = first.type ? TYPE_LABEL[first.type] : 'Trade';
  const more = others > 0 ? ` (+${others} more)` : '';
  return {
    title: `New Congress disclosure: ${ticker}`,
    message: `${first.member} · ${action} · ${first.amount}${more}`,
  };
}

/** Checks one watchlist ticker per call, in rotation, and notifies on new disclosures. */
export async function pollAlerts(): Promise<void> {
  if (!(await isPro())) return;
  const watchlist = await getWatchlist();
  if (watchlist.length === 0) return;

  const cursor = ((await storage.getItem<number>(CURSOR)) ?? 0) % watchlist.length;
  const item = watchlist[cursor];
  if (!item) return;
  const { ticker } = item;
  const response = await getTrades(ticker, 'alert');
  // Budget denied or the request failed: retry the same ticker next time.
  if (!response.fromNetwork) return;

  const seen = (await storage.getItem<SeenMap>(SEEN)) ?? {};
  const fresh = findNewTrades(seen[ticker], response.trades);
  const ids = [...new Set([...response.trades.map((trade) => trade.id), ...(seen[ticker] ?? [])])];

  const watched = new Set(watchlist.map((item) => item.ticker));
  const next: SeenMap = Object.fromEntries(Object.entries(seen).filter(([key]) => watched.has(key)));
  next[ticker] = ids.slice(0, MAX_SEEN_PER_TICKER);

  await Promise.all([
    storage.setItem(SEEN, next),
    storage.setItem(CURSOR, (cursor + 1) % watchlist.length),
  ]);

  const [first, ...others] = fresh;
  if (!first) return;
  await browser.notifications.create(`congress-trades:${ticker}:${Date.now()}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    ...alertText(ticker, first, others.length),
  });
}
