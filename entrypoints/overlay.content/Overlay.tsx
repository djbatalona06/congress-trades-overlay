import { useEffect, useState } from 'react';
import { BARGO_HOME } from '@/lib/bargo';
import { PARTY_NAME, formatDate } from '@/lib/format';
import { requestPaymentPage } from '@/lib/messaging';
import type { Detection } from '@/lib/platforms';
import { getOverlayExpanded, setOverlayExpanded } from '@/lib/settings';
import { TYPE_LABEL } from '@/lib/trades';
import type { CongressTrade, TradesResponse, WatchlistItem } from '@/lib/types';
import {
  FREE_WATCHLIST_LIMIT,
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  watchWatchlist,
} from '@/lib/watchlist';

function TradeRow({ trade }: { trade: CongressTrade }) {
  const seat = [trade.chamber === 'senate' ? 'Senate' : trade.chamber && 'House', trade.state]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="trade">
      <div className="who">
        <span className="member">{trade.member}</span>
        {trade.party && (
          <span className={`party party-${trade.party}`} title={PARTY_NAME[trade.party]}>
            {trade.party}
          </span>
        )}
        {seat && <span className="seat">{seat}</span>}
      </div>
      <div className="what">
        <span className={`type type-${trade.type ?? 'unknown'}`}>
          {trade.type ? TYPE_LABEL[trade.type] : 'Trade'}
        </span>
        <span className="amount">{trade.amount}</span>
      </div>
      <div className="when">
        Filed {formatDate(trade.filedDate)} · Traded {formatDate(trade.transactionDate)}
        {trade.sourceUrl && (
          <>
            {' · '}
            <a href={trade.sourceUrl} target="_blank" rel="noopener noreferrer">
              Filing portal
            </a>
          </>
        )}
      </div>
    </li>
  );
}

function WatchButton({ detection }: { detection: Detection }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  useEffect(() => {
    getWatchlist().then(setWatchlist);
    return watchWatchlist(setWatchlist);
  }, []);

  if (!watchlist) return null;
  const watching = watchlist.some((item) => item.ticker === detection.ticker);

  const toggle = async () => {
    if (watching) {
      setWatchlist(await removeFromWatchlist(detection.ticker));
      setAtLimit(false);
      return;
    }
    const result = await addToWatchlist(detection.ticker, detection.platform);
    setWatchlist(result.watchlist);
    setAtLimit(!result.ok && result.reason === 'limit');
  };

  return (
    <div className="watch">
      <button type="button" className="watch-button" aria-pressed={watching} onClick={toggle}>
        {watching ? `Watching ${detection.ticker}` : `Watch ${detection.ticker}`}
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

export function Overlay({
  detection,
  response,
}: {
  detection: Detection;
  response: TradesResponse;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getOverlayExpanded().then(setExpanded);
  }, []);

  const { trades } = response;
  const limited = response.status === 'limited';
  // Nothing to show and nothing to explain: stay out of the way of the chart.
  if (dismissed || response.status === 'error' || (!limited && trades.length === 0)) return null;

  const toggle = () => {
    setExpanded(!expanded);
    void setOverlayExpanded(!expanded);
  };

  return (
    <section className={expanded ? 'panel expanded' : 'panel'} aria-label="Congress trades">
      <header className="bar">
        <div className="bar-main">
          <button type="button" className="toggle" aria-expanded={expanded} onClick={toggle}>
            <span className="chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            <span className="title">Congress Trades: {detection.ticker}</span>
            <span className="count">{limited ? '(limit reached)' : `(${trades.length} recent)`}</span>
          </button>
          <button
            type="button"
            className="close"
            aria-label="Hide Congress trades"
            onClick={() => setDismissed(true)}
          >
            ×
          </button>
        </div>
        {detection.bond && (
          <p className="bond">
            {detection.ticker} is the underlying stock of {detection.bond}
          </p>
        )}
        {/* Bargo's terms: the credit must be visible on first view, next to the data. */}
        <a className="credit" href={BARGO_HOME} target="_blank" rel="noopener noreferrer">
          Data via Bargo
        </a>
      </header>

      {expanded && (
        <div className="body">
          {limited && (
            <p className="notice">
              Today's free lookups are used up. Add your own free Bargo key in the extension popup
              for more.
            </p>
          )}
          {response.stale && response.fetchedAt !== null && (
            <p className="notice">
              Saved results from {formatDate(new Date(response.fetchedAt).toISOString())}.
            </p>
          )}
          <ul className="trades">
            {trades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </ul>
          <WatchButton detection={detection} />
          <footer className="footer">
            Data:{' '}
            <a href={BARGO_HOME} target="_blank" rel="noopener noreferrer">
              Bargo Congress Trades API
            </a>{' '}
            | Not financial advice. Public STOCK Act data. Delayed.
          </footer>
        </div>
      )}
    </section>
  );
}
