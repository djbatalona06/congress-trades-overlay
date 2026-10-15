import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { isPro } from './pro';
import { getTrades } from './service';
import { type SignalLevel, computeSignals, topReason } from './signals';
import { TYPE_LABEL } from './trades';
import type { CongressTrade } from './types';
import { getWatchlist } from './watchlist';

export const ALERT_ALARM = 'alerts:poll';
export const ALERT_PERIOD_MINUTES = 60;

const CURSOR = 'local:alertCursor';
const SEEN = 'local:alertSeen';
const LEVEL = 'local:alertLevel';
const MAX_SEEN_PER_TICKER = 50;

type SeenMap = Record<string, string[]>;
type LevelMap = Record<string, SignalLevel>;

/** True only when a ticker has just climbed into Hot. A ticker with no history yields false: its first check only sets the baseline. */
export function turnedHot(before: SignalLevel | undefined, now: SignalLevel): boolean {
  return before !== undefined && before !== 'hot' && now === 'hot';
}

/** One notification for a ticker that turned Hot, plus the newest filing if one arrived in the same check. */
export function heatText(
  ticker: string,
  reason: string | null,
  first?: CongressTrade,
  others = 0,
): { title: string; message: string } {
  const title = `${ticker} turned Hot`;
  if (!first) return { title, message: reason ?? 'Congress activity picked up.' };
  const { message } = alertText(ticker, first, others);
  return { title, message: reason ? `${reason} Newest: ${message}` : `Newest: ${message}` };
}

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

  const [seen, levels] = await Promise.all([
    storage.getItem<SeenMap>(SEEN).then((value) => value ?? {}),
    storage.getItem<LevelMap>(LEVEL).then((value) => value ?? {}),
  ]);
  const fresh = findNewTrades(seen[ticker], response.trades);
  const ids = [...new Set([...response.trades.map((trade) => trade.id), ...(seen[ticker] ?? [])])];

  const watched = new Set(watchlist.map((item) => item.ticker));
  const next: SeenMap = Object.fromEntries(Object.entries(seen).filter(([key]) => watched.has(key)));
  next[ticker] = ids.slice(0, MAX_SEEN_PER_TICKER);

  // Signals come from trades already fetched above, so they cost no extra lookups.
  const summary = computeSignals(response.trades, response.context);
  const nextLevels: LevelMap = Object.fromEntries(
    Object.entries(levels).filter(([key]) => watched.has(key)),
  );
  nextLevels[ticker] = summary.level;

  await Promise.all([
    storage.setItem(SEEN, next),
    storage.setItem(LEVEL, nextLevels),
    storage.setItem(CURSOR, (cursor + 1) % watchlist.length),
  ]);

  const [first, ...others] = fresh;
  // One notification per check, even when a new filing and a Hot jump arrive together.
  const heated = turnedHot(levels[ticker], summary.level);
  const text = heated
    ? heatText(ticker, topReason(summary), first, others.length)
    : first && alertText(ticker, first, others.length);
  if (!text) return;
  await browser.notifications.create(`congress-trades:${ticker}:${Date.now()}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    ...text,
  });
}
