import { browser } from 'wxt/browser';
import type { CongressTrade } from './types';

const PREFIX = 'cache:';
// Disclosures are filed days to weeks after a trade, and the daily request
// budget is small, so freshness is traded for lookups.
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  trades: CongressTrade[];
}

export interface CacheRead extends CacheEntry {
  fresh: boolean;
}

export async function readCache(ticker: string, now = Date.now()): Promise<CacheRead | null> {
  const key = PREFIX + ticker;
  const entry = (await browser.storage.local.get(key))[key] as CacheEntry | undefined;
  if (!entry) return null;
  return { ...entry, fresh: now - entry.fetchedAt < CACHE_TTL_MS };
}

export async function writeCache(
  ticker: string,
  trades: CongressTrade[],
  now = Date.now(),
): Promise<void> {
  await browser.storage.local.set({ [PREFIX + ticker]: { fetchedAt: now, trades } });
}

export async function pruneCache(now = Date.now()): Promise<void> {
  const all = await browser.storage.local.get(null);
  const expired = Object.entries(all)
    .filter(([key]) => key.startsWith(PREFIX))
    .filter(([, entry]) => now - (entry as CacheEntry).fetchedAt > MAX_AGE_MS)
    .map(([key]) => key);
  if (expired.length > 0) await browser.storage.local.remove(expired);
}
