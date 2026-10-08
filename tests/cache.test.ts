import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CACHE_TTL_MS, pruneCache, readCache, writeCache } from '@/lib/cache';
import { HOUR, NOON, congressTrade } from './helpers';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('cache', () => {
  it('misses for an unknown ticker', async () => {
    expect(await readCache('NVDA', NOON)).toBeNull();
  });

  it('is fresh inside the TTL and stale after it', async () => {
    await writeCache('NVDA', [congressTrade()], NOON);
    expect(await readCache('NVDA', NOON + CACHE_TTL_MS - 1)).toMatchObject({ fresh: true });
    const stale = await readCache('NVDA', NOON + CACHE_TTL_MS);
    expect(stale).toMatchObject({ fresh: false, fetchedAt: NOON });
    expect(stale?.trades).toHaveLength(1);
  });

  it('remembers that a ticker had no trades', async () => {
    await writeCache('XYZ', [], NOON);
    expect(await readCache('XYZ', NOON)).toMatchObject({ fresh: true, trades: [] });
  });

  it('prunes entries older than a week and leaves other keys alone', async () => {
    await writeCache('OLD', [], NOON - 8 * 24 * HOUR);
    await writeCache('NEW', [], NOON - HOUR);
    await fakeBrowser.storage.local.set({ watchlist: [{ ticker: 'OLD' }] });
    await pruneCache(NOON);
    expect(await readCache('OLD', NOON)).toBeNull();
    expect(await readCache('NEW', NOON)).not.toBeNull();
    expect((await fakeBrowser.storage.local.get('watchlist')).watchlist).toHaveLength(1);
  });
});
