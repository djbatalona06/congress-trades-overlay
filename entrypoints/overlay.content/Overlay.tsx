import { useEffect, useRef, useState } from 'react';
import { TradesBody } from '@/components/TradesBody';
import { WatchButton } from '@/components/WatchButton';
import { BARGO_HOME } from '@/lib/bargo';
import { requestPopOut } from '@/lib/messaging';
import type { Detection } from '@/lib/platforms';
import { getOverlayExpanded, setOverlayExpanded } from '@/lib/settings';
import type { TradesResponse } from '@/lib/types';

export function Overlay({
  detection,
  response,
}: {
  detection: Detection;
  response: TradesResponse;
}) {
  // undefined: still reading. null: the user has never chosen, so they get the
  // edge tab. true/false: a saved choice, kept as the bar they already know.
  const [stored, setStored] = useState<boolean | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tabRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    getOverlayExpanded().then(setStored);
  }, []);

  // Keyboard users: focus goes into the drawer when it opens and back to the tab when it closes.
  useEffect(() => {
    if (!moved.current) return;
    (drawerOpen ? closeRef : tabRef).current?.focus();
  }, [drawerOpen]);

  const { trades } = response;
  const limited = response.status === 'limited';
  // Nothing to show and nothing to explain: stay out of the way of the chart.
  if (
    stored === undefined ||
    dismissed ||
    response.status === 'error' ||
    (!limited && trades.length === 0)
  ) {
    return null;
  }

  const tabMode = stored === null;
  const setDrawer = (open: boolean) => {
    moved.current = true;
    setDrawerOpen(open);
  };

  if (tabMode && !drawerOpen) {
    const label = `${detection.ticker} ${limited ? 'limit' : trades.length}`;
    return (
      <button
        ref={tabRef}
        type="button"
        className="edge-tab"
        aria-expanded={false}
        aria-label={`${label}. Congress trades. Open panel`}
        onClick={() => setDrawer(true)}
      >
        {label}
      </button>
    );
  }

  const expanded = tabMode ? true : stored;
  const toggle = () => {
    if (tabMode) {
      setDrawer(false);
      return;
    }
    setStored(!expanded);
    void setOverlayExpanded(!expanded);
  };

  return (
    <section
      className={`${expanded ? 'panel expanded' : 'panel'}${tabMode ? ' drawer' : ''}`}
      aria-label="Congress trades"
      onKeyDown={(event) => {
        if (tabMode && event.key === 'Escape') setDrawer(false);
      }}
    >
      <header className="bar">
        <div className="bar-main">
          <button type="button" className="toggle" aria-expanded={expanded} onClick={toggle}>
            <span className="chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            <span className="title">Congress Trades: {detection.ticker}</span>
            <span className="count">{limited ? '(daily limit reached)' : `(${trades.length} recent)`}</span>
          </button>
          <button
            type="button"
            className="popout"
            aria-label="Pop out to a separate window"
            title="Pop out to a separate window"
            onClick={() => void requestPopOut()}
          >
            ⧉
          </button>
          <button
            ref={closeRef}
            type="button"
            className="close"
            aria-label={tabMode ? 'Close panel' : 'Hide Congress trades'}
            onClick={() => (tabMode ? setDrawer(false) : setDismissed(true))}
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
          <TradesBody response={response} />
          <WatchButton ticker={detection.ticker} platform={detection.platform} />
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
