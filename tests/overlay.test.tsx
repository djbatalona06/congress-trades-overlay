// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Overlay } from '@/entrypoints/overlay.content/Overlay';
import type { Detection } from '@/lib/platforms';
import { getOverlayExpanded } from '@/lib/settings';
import type { TradesResponse } from '@/lib/types';
import { addToWatchlist, getWatchlist } from '@/lib/watchlist';
import { budget, congressTrade } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NVDA: Detection = { platform: 'tradingview', ticker: 'NVDA', bond: null };

function response(overrides: Partial<TradesResponse> = {}): TradesResponse {
  return {
    status: 'ok',
    ticker: 'NVDA',
    trades: [
      congressTrade(),
      congressTrade({ id: 'b', member: 'Ro Khanna', party: null, type: 'sale', chamber: 'senate', state: 'CA' }),
    ],
    fetchedAt: Date.now(),
    stale: false,
    fromNetwork: true,
    budget: budget(),
    ...overrides,
  };
}

let host: HTMLElement;
let root: Root;

async function render(detection: Detection, tradesResponse: TradesResponse) {
  await act(async () => {
    root.render(<Overlay detection={detection} response={tradesResponse} />);
  });
}

async function click(element: Element | null | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    (element as HTMLElement).click();
  });
}

const text = () => host.textContent ?? '';
const toggle = () => host.querySelector('.toggle');

beforeEach(() => {
  fakeBrowser.reset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('Overlay', () => {
  it('starts collapsed with the ticker, count and Bargo credit visible', async () => {
    await render(NVDA, response());
    expect(text()).toContain('Congress Trades: NVDA');
    expect(text()).toContain('(2 recent)');
    expect(host.querySelector('.bar a.credit')).toMatchObject({
      textContent: 'Data via Bargo',
      href: 'https://www.bargo.ai/',
      target: '_blank',
    });
    expect(host.querySelectorAll('.trade')).toHaveLength(0);
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands to the trade list, disclaimer and filing links, and remembers it', async () => {
    await render(NVDA, response());
    await click(toggle());

    const rows = [...host.querySelectorAll('.trade')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Nancy Pelosi');
    expect(rows[0]?.querySelector('.party')).toMatchObject({ textContent: 'D', title: 'Democrat' });
    expect(rows[0]?.textContent).toContain('House · CA11');
    expect(rows[0]?.textContent).toContain('Buy');
    expect(rows[0]?.textContent).toContain('$1,001 - $15,000');
    expect(rows[0]?.textContent).toContain('Filed Sep 10, 2026 · Traded Aug 18, 2026');
    expect(rows[0]?.querySelector('.when a')?.getAttribute('rel')).toBe('noopener noreferrer');

    expect(rows[1]?.querySelector('.party')).toBeNull();
    expect(rows[1]?.textContent).toContain('Senate · CA');
    expect(rows[1]?.textContent).toContain('Sell');

    expect(text()).toContain('Not financial advice. Public STOCK Act data. Delayed.');
    expect(await getOverlayExpanded()).toBe(true);
  });

  it('opens expanded when that was the last state', async () => {
    await fakeBrowser.storage.local.set({ overlayExpanded: true });
    await render(NVDA, response());
    expect(host.querySelectorAll('.trade')).toHaveLength(2);
  });

  it('explains a bond chart', async () => {
    await render({ platform: 'tradingview', ticker: 'AAPL', bond: 'AAPL4242667' }, response());
    expect(text()).toContain('AAPL is the underlying stock of AAPL4242667');
  });

  it.each([
    ['there are no trades', response({ trades: [] })],
    ['the lookup failed', response({ status: 'error', trades: [] })],
  ])('renders nothing when %s', async (_name, tradesResponse) => {
    await render(NVDA, tradesResponse);
    expect(host.innerHTML).toBe('');
  });

  it('says so when the daily limit is reached and nothing is saved', async () => {
    await render(NVDA, response({ status: 'limited', trades: [], fromNetwork: false }));
    expect(text()).toContain('(limit reached)');
    await click(toggle());
    expect(text()).toContain("Today's free lookups are used up");
  });

  it('labels saved results', async () => {
    const fetchedAt = Date.parse('2026-10-01T15:00:00Z');
    await render(NVDA, response({ stale: true, fetchedAt, fromNetwork: false }));
    await click(toggle());
    expect(text()).toContain('Saved results from Oct 1, 2026.');
  });

  it('can be dismissed', async () => {
    await render(NVDA, response());
    await click(host.querySelector('.close'));
    expect(host.innerHTML).toBe('');
  });

  it('adds and removes the ticker from the watchlist', async () => {
    await render(NVDA, response());
    await click(toggle());
    const button = () => host.querySelector('.watch-button');

    expect(button()?.textContent).toBe('Watch NVDA');
    await click(button());
    expect(button()?.textContent).toBe('Watching NVDA');
    expect(await getWatchlist()).toMatchObject([{ ticker: 'NVDA', platform: 'tradingview' }]);

    await click(button());
    expect(button()?.textContent).toBe('Watch NVDA');
    expect(await getWatchlist()).toEqual([]);
  });

  it('offers Pro when the free watchlist is full', async () => {
    for (const ticker of ['AAPL', 'MSFT', 'TSLA']) await addToWatchlist(ticker, null);
    await render(NVDA, response());
    await click(toggle());
    await click(host.querySelector('.watch-button'));
    expect(text()).toContain('The free plan watches 3 tickers.');
    expect(host.querySelector('.watch .link')?.textContent).toBe('Upgrade to Pro');
    expect(await getWatchlist()).toHaveLength(3);
  });
});
