// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { GraphPanel } from '@/components/GraphPanel';
import { Panel, SPLIT_MIN_WIDTH } from '@/entrypoints/panel/Panel';
import { setCurrentTicker } from '@/lib/settings';
import type { TradesResponse } from '@/lib/types';
import { budget, congressTrade } from './helpers';

const TRADES = [
  congressTrade({ id: '1', type: 'purchase', transactionDate: '2026-10-01', memberSlug: 'a' }),
  congressTrade({ id: '2', type: 'sale', transactionDate: '2026-09-29', memberSlug: 'b', party: 'R' }),
  congressTrade({ id: '3', type: 'purchase', transactionDate: '2026-08-20', memberSlug: 'a' }),
];
const NOW = Date.parse('2026-10-07T12:00:00Z');

const RESPONSE: TradesResponse = {
  status: 'ok',
  ticker: 'NVDA',
  trades: TRADES,
  fetchedAt: NOW,
  stale: false,
  fromNetwork: true,
  budget: budget(),
};
vi.mock('@/lib/messaging', () => ({
  requestTrades: async () => RESPONSE,
  requestPaymentPage: vi.fn(),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
const text = () => host.textContent ?? '';
const click = (el: Element | null | undefined) => act(async () => (el as HTMLElement).click());

beforeEach(() => {
  fakeBrowser.reset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.innerWidth = 1024;
});

describe('GraphPanel', () => {
  it('shows the numbers for the chosen range and says how much data it used', async () => {
    await act(async () => root.render(<GraphPanel ticker="NVDA" trades={TRADES} now={NOW} />));
    expect(text()).toContain('Graphs for NVDA');
    expect(text()).toContain('Based on the 3 most recent disclosures loaded for NVDA');
    const ranges = [...host.querySelectorAll('.range')];
    expect(ranges.map((r) => r.textContent)).toEqual(['7 days', '30 days', '90 days']);
    expect(ranges[2]?.getAttribute('aria-pressed')).toBe('true'); // 90 days by default
    expect(host.querySelector('.scorecards')?.textContent).toContain('Trades3');

    await click(ranges[0]); // 7 days: only the Oct 1 trade
    expect(ranges[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.scorecards')?.textContent).toContain('Trades1');
  });

  it('gives the chart a text summary and a table', async () => {
    await act(async () => root.render(<GraphPanel ticker="NVDA" trades={TRADES} now={NOW} />));
    expect(host.querySelector('svg')?.getAttribute('aria-label')).toMatch(/week of 2026-09-28: 1 buys, 1 sells/);
    expect(host.querySelector('.as-table table')).toBeTruthy();
  });

  it('says so when nothing falls in the range', async () => {
    await act(async () => root.render(<GraphPanel ticker="NVDA" trades={[]} now={NOW} />));
    expect(text()).toContain('No buys or sells dated in this range.');
  });
});

describe('pop-out layout', () => {
  async function open(width: number) {
    window.innerWidth = width;
    await act(async () => root.render(<Panel />));
    await act(async () => {
      await setCurrentTicker({ ticker: 'NVDA', bond: null, platform: 'tradingview', at: Date.now() });
    });
  }

  it('shows the list and the graphs side by side when the window is wide', async () => {
    await open(SPLIT_MIN_WIDTH + 100);
    expect(host.querySelector('.split')).toBeTruthy();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(text()).toContain('Graphs for NVDA');
    expect(text()).toContain('Nancy Pelosi');
  });

  it('moves the divider with the arrow keys and keeps it in range', async () => {
    await open(SPLIT_MIN_WIDTH + 100);
    const divider = host.querySelector<HTMLElement>('[role="separator"]');
    expect(divider?.getAttribute('aria-valuenow')).toBe('50');
    const press = (key: string) =>
      act(async () => {
        divider?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    await press('ArrowRight');
    expect(divider?.getAttribute('aria-valuenow')).toBe('55');
    await press('End');
    await press('ArrowRight');
    expect(divider?.getAttribute('aria-valuenow')).toBe('70');
    await press('Home');
    expect(divider?.getAttribute('aria-valuenow')).toBe('30');
  });

  it('falls back to List and Graphs tabs when the window is narrow', async () => {
    await open(SPLIT_MIN_WIDTH - 100);
    expect(host.querySelector('.split')).toBeNull();
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['List', 'Graphs']);
    expect(text()).toContain('Nancy Pelosi');
    expect(text()).not.toContain('Graphs for NVDA');

    await click(tabs[1]);
    expect(text()).toContain('Graphs for NVDA');
    expect(text()).not.toContain('Nancy Pelosi');
  });

  it('switches layout when the window is resized', async () => {
    await open(SPLIT_MIN_WIDTH + 100);
    await act(async () => {
      window.innerWidth = 400;
      window.dispatchEvent(new Event('resize'));
    });
    expect(host.querySelector('.split')).toBeNull();
    expect(host.querySelector('[role="tablist"]')).toBeTruthy();
  });
});
