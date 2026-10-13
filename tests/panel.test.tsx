// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Panel } from '@/entrypoints/panel/Panel';
import { getPopoutBounds, setCurrentTicker } from '@/lib/settings';
import type { TradesResponse } from '@/lib/types';
import { budget, congressTrade } from './helpers';

const requestTrades = vi.fn<(ticker: string) => Promise<TradesResponse>>();
vi.mock('@/lib/messaging', () => ({
  requestTrades: (ticker: string) => requestTrades(ticker),
  requestPaymentPage: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function response(ticker: string, member: string): TradesResponse {
  return {
    status: 'ok',
    ticker,
    trades: [congressTrade({ ticker, member })],
    fetchedAt: Date.now(),
    stale: false,
    fromNetwork: true,
    budget: budget(),
  };
}

let host: HTMLElement;
let root: Root;
const text = () => host.textContent ?? '';

async function publish(ticker: string) {
  await act(async () => {
    await setCurrentTicker({ ticker, bond: null, platform: 'tradingview', at: Date.now() });
  });
}

beforeEach(async () => {
  fakeBrowser.reset();
  requestTrades.mockReset();
  requestTrades.mockImplementation(async (ticker) =>
    response(ticker, ticker === 'NVDA' ? 'Nancy Pelosi' : 'Ro Khanna'),
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Panel />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('pop-out panel', () => {
  it('asks for a stock page before any symbol is known', () => {
    expect(text()).toContain('Open a stock page on a supported site');
    expect(requestTrades).not.toHaveBeenCalled();
  });

  it('shows the trades for the symbol on screen and follows it when the chart changes', async () => {
    await publish('NVDA');
    expect(text()).toContain('NVDA');
    expect(text()).toContain('Nancy Pelosi');

    await publish('MSFT');
    expect(text()).toContain('MSFT');
    expect(text()).toContain('Ro Khanna');
    expect(text()).not.toContain('Nancy Pelosi');
    expect(requestTrades).toHaveBeenCalledTimes(2);
  });

  it('keeps the Bargo credit visible and does not trust a bad stored symbol', async () => {
    expect(host.querySelector<HTMLAnchorElement>('header a')?.href).toBe('https://www.bargo.ai/');
    await publish('<script>');
    expect(requestTrades).not.toHaveBeenCalled();
  });

  it('saves the window position and size when it closes', async () => {
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(await getPopoutBounds()).toEqual({
      left: window.screenX,
      top: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
    });
  });
});
