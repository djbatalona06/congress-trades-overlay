import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { BARGO_HOME, BARGO_KEY_URL } from '@/lib/bargo';
import { readBudget } from '@/lib/budget';
import { type RefreshResult, createExtPay, refreshPro } from '@/lib/extpay';
import { lookupsLeft, lookupsPerDay } from '@/lib/format';
import {
  getApiKey,
  getHudEnabled,
  getInfluenceEnabled,
  setApiKey,
  setHudEnabled,
  setInfluenceEnabled,
} from '@/lib/settings';
import { WAITLIST_URL } from '@/lib/site';
import type { BudgetState, WatchlistItem } from '@/lib/types';
import { type AddResult, addToWatchlist, getWatchlist, removeFromWatchlist } from '@/lib/watchlist';
import { PANEL_ID, type TabDef, Tabs, tabId } from './Tabs';
import { UpdateGate } from './UpdateGate';

const TABS = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'plan', label: 'Plan' },
  { id: 'lookups', label: 'Lookups' },
] as const satisfies readonly TabDef<string>[];
type TabKey = (typeof TABS)[number]['id'];

const ADD_ERRORS: Record<Extract<AddResult, { ok: false }>['reason'], string> = {
  invalid: 'Enter a US stock ticker, like NVDA.',
  duplicate: 'That ticker is already on your watchlist.',
};

function Watchlist() {
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
          {watchlist.length} {watchlist.length === 1 ? 'ticker' : 'tickers'}
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
      <div role="status">{error && <p className="error">{error}</p>}</div>
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

function HudToggle() {
  // undefined until the saved choice is read, so the box never flickers.
  const [on, setOn] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    getHudEnabled().then(setOn);
  }, []);

  return (
    <section>
      <h2>Floating signal box</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={on ?? true}
          disabled={on === undefined}
          onChange={(event) => {
            setOn(event.target.checked);
            void setHudEnabled(event.target.checked);
          }}
        />
        Show it on charts
      </label>
      <p className="muted">
        A small box that says how busy Congress has been in a stock: Quiet, Watch or Hot. You can drag it
        anywhere.
      </p>
    </section>
  );
}

function InfluenceToggle() {
  const [on, setOn] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    getInfluenceEnabled().then(setOn);
  }, []);

  return (
    <section>
      <h2>Influence (early)</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={on ?? false}
          disabled={on === undefined}
          onChange={(event) => {
            setOn(event.target.checked);
            void setInfluenceEnabled(event.target.checked);
          }}
        />
        Show tax breaks and outside money
      </label>
      <p className="muted">
        Adds an Influence list to the panel when the extra data service is on. It only reports what was
        filed. It never says why, and it never changes Quiet, Watch or Hot.
      </p>
    </section>
  );
}

export type PlanStatus =
  | { kind: 'checking' }
  | { kind: 'pro'; checkedAt: number }
  | { kind: 'free'; checkedAt: number }
  | { kind: 'offline-pro'; checkedAt: number }
  | { kind: 'offline' };

export function planStatus(result: RefreshResult): PlanStatus {
  if (result.ok) {
    return { kind: result.paid ? 'pro' : 'free', checkedAt: result.checkedAt };
  }
  return result.cachedPaid && result.checkedAt !== null
    ? { kind: 'offline-pro', checkedAt: result.checkedAt }
    : { kind: 'offline' };
}

const formatChecked = (at: number) =>
  new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function Plan({ status, onRetry }: { status: PlanStatus; onRetry: () => void }) {
  const extpay = createExtPay();
  return (
    <section>
      <h2>Plan</h2>
      <p>
        Everything in Capitol Tape is free: the panel, the signal box, an unlimited watchlist and alerts
        when a watched stock gets a new filing or turns Hot.
      </p>
      <p>
        Policy Pro is coming: alerts on bills and executive orders for your sectors.{' '}
        <a href={WAITLIST_URL} target="_blank" rel="noopener noreferrer">
          Join the waitlist
        </a>
      </p>
      <div role="status">
        {status.kind === 'pro' && (
          <p>You have an active subscription. Last checked {formatChecked(status.checkedAt)}.</p>
        )}
        {status.kind === 'offline-pro' && (
          <p className="error">
            Couldn&apos;t reach the payment server. Showing your subscription from{' '}
            {formatChecked(status.checkedAt)}.
          </p>
        )}
      </div>
      {status.kind === 'pro' && (
        <button type="button" onClick={() => void extpay.openPaymentPage()}>
          Manage subscription
        </button>
      )}
      {status.kind === 'offline-pro' && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
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
            Optional: a{' '}
            <a href={BARGO_KEY_URL} target="_blank" rel="noopener noreferrer">
              free Bargo key
            </a>{' '}
            raises your daily lookups. Paste it here; it stays on this device.
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
  const [plan, setPlan] = useState<PlanStatus>({ kind: 'checking' });
  // Not saved between opens: a remembered tab is a convenience, not a need.
  const [tab, setTab] = useState<TabKey>('watchlist');

  const check = useCallback(async () => {
    setPlan({ kind: 'checking' });
    const result = await refreshPro();
    setPlan(planStatus(result));
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <main>
      <header>
        <img src="/icon/32.png" width="24" height="24" alt="" />
        <h1>Capitol Tape</h1>
        <Tabs tabs={TABS} selected={tab} onSelect={setTab} />
      </header>
      <UpdateGate />
      <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(tab)} tabIndex={0}>
        {tab === 'watchlist' && (
          <>
            <Watchlist />
            <HudToggle />
            <InfluenceToggle />
          </>
        )}
        {tab === 'plan' && <Plan status={plan} onRetry={() => void check()} />}
        {tab === 'lookups' && <Lookups />}
      </div>
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
