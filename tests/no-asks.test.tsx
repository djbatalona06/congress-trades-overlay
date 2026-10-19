// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Overlay } from '@/entrypoints/overlay.content/Overlay';
import { Panel } from '@/entrypoints/panel/Panel';
import { setCurrentTicker } from '@/lib/settings';
import type { TradesResponse } from '@/lib/types';
import { budget, congressTrade } from './helpers';

vi.mock('@/lib/messaging', () => ({
  requestTrades: async (): Promise<TradesResponse> => response('limited'),
  requestPopOut: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 5 U.S.C. 13107(c)(1)(D): nothing that shows trade data asks for money.
const ASK = /upgrade|\bpro\b|donat|subscribe|pricing|waitlist|newsletter/i;

function response(status: TradesResponse['status'] = 'ok'): TradesResponse {
  return {
    status,
    ticker: 'NVDA',
    trades: [congressTrade(), congressTrade({ id: 'b', chamber: null, sourceUrl: null })],
    fetchedAt: Date.now(),
    stale: true,
    fromNetwork: false,
    budget: budget(),
  };
}

let host: HTMLElement;
let root: Root;

function expectNoAsks() {
  expect(host.textContent ?? '').not.toMatch(ASK);
  for (const a of host.querySelectorAll('a')) expect(a.href).not.toMatch(ASK);
}

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

describe('no money asks next to trade data', () => {
  it('the on-page panel, expanded, at the limit and with saved results', async () => {
    await fakeBrowser.storage.local.set({ overlayExpanded: true });
    await act(async () => {
      root.render(
        <Overlay detection={{ platform: 'tradingview', ticker: 'NVDA', bond: null }} response={response('limited')} />,
      );
    });
    expect(host.querySelectorAll('.trade').length).toBeGreaterThan(0);
    expectNoAsks();
  });

  it('the pop-out window', async () => {
    await act(async () => root.render(<Panel />));
    await act(async () => {
      await setCurrentTicker({ ticker: 'NVDA', bond: null, platform: 'tradingview', at: Date.now() });
    });
    expect(host.querySelectorAll('.trade').length).toBeGreaterThan(0);
    expectNoAsks();
  });
});
