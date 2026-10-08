import { storage } from 'wxt/utils/storage';
import { isPro } from './pro';
import { resolveTicker } from './ticker';
import type { Platform, WatchlistItem } from './types';

const KEY = 'local:watchlist';
export const FREE_WATCHLIST_LIMIT = 3;

export type AddResult =
  | { ok: true; watchlist: WatchlistItem[] }
  | { ok: false; reason: 'invalid' | 'duplicate' | 'limit'; watchlist: WatchlistItem[] };

export async function getWatchlist(): Promise<WatchlistItem[]> {
  return (await storage.getItem<WatchlistItem[]>(KEY)) ?? [];
}

export async function addToWatchlist(
  input: string,
  platform: Platform | null,
  now = Date.now(),
): Promise<AddResult> {
  const watchlist = await getWatchlist();
  const ticker = resolveTicker(input)?.ticker;
  if (!ticker) return { ok: false, reason: 'invalid', watchlist };
  if (watchlist.some((item) => item.ticker === ticker)) {
    return { ok: false, reason: 'duplicate', watchlist };
  }
  if (watchlist.length >= FREE_WATCHLIST_LIMIT && !(await isPro(now))) {
    return { ok: false, reason: 'limit', watchlist };
  }
  const next = [...watchlist, { ticker, addedAt: now, platform }];
  await storage.setItem(KEY, next);
  return { ok: true, watchlist: next };
}

export async function removeFromWatchlist(ticker: string): Promise<WatchlistItem[]> {
  const next = (await getWatchlist()).filter((item) => item.ticker !== ticker);
  await storage.setItem(KEY, next);
  return next;
}

export function watchWatchlist(callback: (watchlist: WatchlistItem[]) => void): () => void {
  return storage.watch<WatchlistItem[]>(KEY, (value) => callback(value ?? []));
}
