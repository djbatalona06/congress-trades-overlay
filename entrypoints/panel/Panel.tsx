import { useEffect, useState } from 'react';
import { TradesBody } from '@/components/TradesBody';
import { WatchButton } from '@/components/WatchButton';
import { useTrades } from '@/components/useTrades';
import { BARGO_HOME } from '@/lib/bargo';
import { readWindowBounds } from '@/lib/popout';
import {
  type CurrentTicker,
  getCurrentTicker,
  setPopoutBounds,
  watchCurrentTicker,
} from '@/lib/settings';
import { resolveTicker } from '@/lib/ticker';

/** Remembers where the window sits so it comes back to the same screen. */
function useSaveBounds() {
  useEffect(() => {
    let last = '';
    const save = () => {
      const bounds = readWindowBounds(window);
      const key = JSON.stringify(bounds);
      if (key === last) return;
      last = key;
      void setPopoutBounds(bounds);
    };
    // There is no "window moved" event, so check now and then as well as on close.
    const timer = setInterval(save, 3000);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', save);
    };
  }, []);
}

export function Panel() {
  const [current, setCurrent] = useState<CurrentTicker | null>(null);
  useSaveBounds();

  useEffect(() => {
    getCurrentTicker().then(setCurrent);
    return watchCurrentTicker(setCurrent);
  }, []);

  // The value comes from storage written by a content script; check it again here.
  const ticker = current ? (resolveTicker(current.ticker)?.ticker ?? null) : null;
  const response = useTrades(ticker);

  let body;
  if (!current || !ticker) {
    body = <p className="empty">Open a stock page on a supported site and its trades show up here.</p>;
  } else if (!response) {
    body = <p className="empty">Loading {ticker}…</p>;
  } else if (response.status === 'error') {
    body = <p className="empty">Couldn&apos;t load trades for {ticker}. Try again in a moment.</p>;
  } else if (response.trades.length === 0 && response.status !== 'limited') {
    body = <p className="empty">No recent disclosures for {ticker}.</p>;
  } else {
    body = (
      <>
        <TradesBody response={response} />
        <WatchButton ticker={ticker} platform={current.platform} />
      </>
    );
  }

  return (
    <main>
      <header>
        <h1>Congress Trades</h1>
        <p role="status" className="current">
          {ticker ?? 'No symbol yet'}
          {current?.bond ? ` (underlying stock of ${current.bond})` : ''}
        </p>
        <a href={BARGO_HOME} target="_blank" rel="noopener noreferrer">
          Data via Bargo
        </a>
      </header>
      {body}
      <footer>
        Public STOCK Act disclosures, filed up to 45 days after a trade. For information only; not
        financial, investment or trading advice.
      </footer>
    </main>
  );
}
