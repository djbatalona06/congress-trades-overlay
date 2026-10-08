import { type FormEvent, useEffect, useState } from 'react';
import { BARGO_HOME } from '@/lib/bargo';
import { readBudget } from '@/lib/budget';
import { createExtPay, refreshPro } from '@/lib/extpay';
import { lookupsLeft, lookupsPerDay } from '@/lib/format';
import { isPro } from '@/lib/pro';
import { getApiKey, setApiKey } from '@/lib/settings';
import type { BudgetState, WatchlistItem } from '@/lib/types';
import {
  type AddResult,
  FREE_WATCHLIST_LIMIT,
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from '@/lib/watchlist';

const ADD_ERRORS: Record<Extract<AddResult, { ok: false }>['reason'], string> = {
  invalid: 'Enter a US stock ticker, like NVDA.',
  duplicate: 'That ticker is already on your watchlist.',
  limit: `The free plan watches ${FREE_WATCHLIST_LIMIT} tickers. Upgrade to Pro for more.`,
};

function Watchlist({ pro }: { pro: boolean }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWatchlist().then(setWatchlist);
  }, []);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const result = await addToWatchlist(input, null);
    setWatchlist(result.watchlist);
    setError(result.ok ? null : ADD_ERRORS[result.reason]);
    if (result.ok) setInput('');
  };

  return (
    <section>
      <h2>
        Watchlist
        <span className="muted">
          {pro ? `${watchlist.length} tickers` : `${watchlist.length} of ${FREE_WATCHLIST_LIMIT}`}
        </span>
      </h2>
      <form className="row" onSubmit={add}>
        <input
          aria-label="Ticker to watch"
          placeholder="Add ticker, e.g. NVDA"
          value={input}
          maxLength={8}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" disabled={input.trim() === ''}>
          Add
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {watchlist.length === 0 ? (
        <p className="muted">No tickers yet. Add one here or from the panel on a chart.</p>
      ) : (
        <ul className="tickers">
          {watchlist.map((item) => (
            <li key={item.ticker}>
              <span>{item.ticker}</span>
              <button
                type="button"
                className="ghost"
                aria-label={`Remove ${item.ticker}`}
                onClick={async () => setWatchlist(await removeFromWatchlist(item.ticker))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Plan({ pro }: { pro: boolean }) {
  const extpay = createExtPay();
  return (
    <section>
      <h2>Plan</h2>
      {pro ? (
        <>
          <p>Pro is active: unlimited watchlist and new-disclosure alerts.</p>
          <button type="button" onClick={() => void extpay.openPaymentPage()}>
            Manage subscription
          </button>
        </>
      ) : (
        <>
          <p>Pro, $8/month: unlimited watchlist and alerts when a watched ticker gets a new disclosure.</p>
          <div className="row">
            <button type="button" className="primary" onClick={() => void extpay.openPaymentPage()}>
              Upgrade to Pro
            </button>
            <button type="button" className="ghost" onClick={() => void extpay.openLoginPage()}>
              Already paid? Log in
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Lookups() {
  const [budget, setBudget] = useState<BudgetState | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [input, setInput] = useState('');

  const load = async () => {
    const key = await getApiKey();
    setHasKey(key !== null);
    setBudget(await readBudget(key !== null));
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (value: string) => {
    await setApiKey(value);
    setInput('');
    await load();
  };

  return (
    <section>
      <h2>Daily lookups</h2>
      {budget && (
        <p>
          {lookupsLeft(budget)} of {lookupsPerDay(budget)} left today.
        </p>
      )}
      {hasKey ? (
        <div className="row">
          <span className="muted">Using your Bargo key.</span>
          <button type="button" className="ghost" onClick={() => void save('')}>
            Remove key
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Need more? Get a free key from{' '}
            <a href={BARGO_HOME} target="_blank" rel="noopener noreferrer">
              Bargo
            </a>{' '}
            and paste it here. It stays on this device.
          </p>
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault();
              void save(input);
            }}
          >
            <input
              type="password"
              aria-label="Bargo API key"
              placeholder="Bargo API key"
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" disabled={input.trim() === ''}>
              Save
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export function Popup() {
  const [pro, setPro] = useState(false);

  useEffect(() => {
    // Show the cached status immediately, then confirm it with the payment server.
    isPro().then(setPro);
    refreshPro().then(setPro);
  }, []);

  return (
    <main>
      <header>
        <img src="/icon/32.png" width="24" height="24" alt="" />
        <h1>Congress Trades Overlay</h1>
        <span className={pro ? 'badge pro' : 'badge'}>{pro ? 'Pro' : 'Free'}</span>
      </header>
      <Watchlist pro={pro} />
      <Plan pro={pro} />
      <Lookups />
      <footer>
        Data via{' '}
        <a href={BARGO_HOME} target="_blank" rel="noopener noreferrer">
          Bargo Congress Trades API
        </a>
        . Public STOCK Act disclosures, filed up to 45 days after a trade. For information only; not
        financial, investment or trading advice. Not affiliated with TradingView, Robinhood, Webull,
        Schwab or the U.S. Congress.
      </footer>
    </main>
  );
}
