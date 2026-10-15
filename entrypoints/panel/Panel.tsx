import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { GraphPanel } from '@/components/GraphPanel';
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

/** Wide enough for the list and the graphs side by side; narrower windows get tabs instead. */
export const SPLIT_MIN_WIDTH = 560;
const SPLIT_MIN = 30;
const SPLIT_MAX = 70;
const SPLIT_STEP = 5;

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

const clampSplit = (value: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(value)));

type Pane = 'list' | 'graphs';

export function Panel() {
  const [current, setCurrent] = useState<CurrentTicker | null>(null);
  const [pane, setPane] = useState<Pane>('list');
  const [split, setSplit] = useState(50);
  const splitRef = useRef<HTMLDivElement>(null);
  const width = useWindowWidth();
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

  const graphs =
    ticker && response && response.trades.length > 0 ? (
      <GraphPanel ticker={ticker} trades={response.trades} />
    ) : (
      <p className="empty">Graphs show here once a stock has recent disclosures.</p>
    );

  const dragTo = (event: PointerEvent<HTMLDivElement>) => {
    const box = splitRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setSplit(clampSplit(((event.clientX - box.left) / box.width) * 100));
  };
  const onDividerKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === 'ArrowLeft' ? split - SPLIT_STEP
      : event.key === 'ArrowRight' ? split + SPLIT_STEP
      : event.key === 'Home' ? SPLIT_MIN
      : event.key === 'End' ? SPLIT_MAX
      : null;
    if (next === null) return;
    event.preventDefault();
    setSplit(clampSplit(next));
  };

  const wide = width >= SPLIT_MIN_WIDTH;

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
      {wide ? (
        <div
          className="split"
          ref={splitRef}
          style={{ gridTemplateColumns: `${split}fr 8px ${100 - split}fr` }}
        >
          <section className="pane" aria-label="Trades">
            {body}
          </section>
          <div
            className="divider"
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize trades and graphs"
            aria-valuenow={split}
            aria-valuemin={SPLIT_MIN}
            aria-valuemax={SPLIT_MAX}
            onKeyDown={onDividerKey}
            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) dragTo(event);
            }}
          />
          <section className="pane" aria-label="Graphs">
            {graphs}
          </section>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Trades or graphs" className="pane-tabs">
            {(['list', 'graphs'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`pane-tab-${id}`}
                aria-selected={pane === id}
                aria-controls="pane-body"
                tabIndex={pane === id ? 0 : -1}
                className="pane-tab"
                onClick={() => setPane(id)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    const other = id === 'list' ? 'graphs' : 'list';
                    setPane(other);
                    document.getElementById(`pane-tab-${other}`)?.focus();
                  }
                }}
              >
                {id === 'list' ? 'List' : 'Graphs'}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="pane-body" aria-labelledby={`pane-tab-${pane}`} className="pane">
            {pane === 'list' ? body : graphs}
          </div>
        </>
      )}
      <footer>
        Public STOCK Act disclosures, filed up to 45 days after a trade. For information only; not
        financial, investment or trading advice.
      </footer>
    </main>
  );
}
