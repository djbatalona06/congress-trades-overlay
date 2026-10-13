import { useEffect, useState } from 'react';
import { requestPaymentPage } from '@/lib/messaging';
import type { Platform, WatchlistItem } from '@/lib/types';
import {
  FREE_WATCHLIST_LIMIT,
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  watchWatchlist,
} from '@/lib/watchlist';

export function WatchButton({ ticker, platform }: { ticker: string; platform: Platform | null }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  useEffect(() => {
    getWatchlist().then(setWatchlist);
    return watchWatchlist(setWatchlist);
  }, []);

  if (!watchlist) return null;
  const watching = watchlist.some((item) => item.ticker === ticker);

  const toggle = async () => {
    if (watching) {
      setWatchlist(await removeFromWatchlist(ticker));
      setAtLimit(false);
      return;
    }
    const result = await addToWatchlist(ticker, platform);
    setWatchlist(result.watchlist);
    setAtLimit(!result.ok && result.reason === 'limit');
  };

  return (
    <div className="watch">
      <button type="button" className="watch-button" aria-pressed={watching} onClick={toggle}>
        {watching ? `Watching ${ticker}` : `Watch ${ticker}`}
      </button>
      {atLimit && (
        <p className="notice">
          The free plan watches {FREE_WATCHLIST_LIMIT} tickers.{' '}
          <button type="button" className="link" onClick={() => void requestPaymentPage()}>
            Upgrade to Pro
          </button>{' '}
          for an unlimited watchlist and alerts.
        </p>
      )}
    </div>
  );
}
