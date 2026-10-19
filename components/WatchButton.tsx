import { useEffect, useState } from 'react';
import type { Platform, WatchlistItem } from '@/lib/types';
import { addToWatchlist, getWatchlist, removeFromWatchlist, watchWatchlist } from '@/lib/watchlist';

export function WatchButton({ ticker, platform }: { ticker: string; platform: Platform | null }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);

  useEffect(() => {
    getWatchlist().then(setWatchlist);
    return watchWatchlist(setWatchlist);
  }, []);

  if (!watchlist) return null;
  const watching = watchlist.some((item) => item.ticker === ticker);

  const toggle = async () => {
    setWatchlist(
      watching ? await removeFromWatchlist(ticker) : (await addToWatchlist(ticker, platform)).watchlist,
    );
  };

  return (
    <div className="watch">
      <button type="button" className="watch-button" aria-pressed={watching} onClick={toggle}>
        {watching ? `Watching ${ticker}` : `Watch ${ticker}`}
      </button>
    </div>
  );
}
