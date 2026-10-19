// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Popup } from '@/entrypoints/popup/Popup';

// The payment server is not part of this test.
vi.mock('@/lib/extpay', () => ({
  createExtPay: () => ({ openPaymentPage: vi.fn(), openLoginPage: vi.fn() }),
  refreshPro: vi.fn(async () => ({ ok: true, paid: false, checkedAt: Date.now() })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

const tabs = () => [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
const selected = () => tabs().find((tab) => tab.getAttribute('aria-selected') === 'true');
const panel = () => host.querySelector('[role="tabpanel"]');

async function press(key: string) {
  await act(async () => {
    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  });
}

beforeEach(async () => {
  fakeBrowser.reset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Popup />));
  tabs()[0]?.focus();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('popup header menu', () => {
  it('has three tabs and starts on Watchlist', () => {
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Watchlist', 'Plan', 'Lookups']);
    expect(selected()?.textContent).toBe('Watchlist');
    expect(host.querySelector('header .badge')).toBeNull();
  });

  it('Right moves to Plan and the panel is labelled by the active tab', async () => {
    await press('ArrowRight');
    expect(selected()?.textContent).toBe('Plan');
    expect(document.activeElement).toBe(selected());
    expect(panel()?.getAttribute('aria-labelledby')).toBe(selected()?.id);
    expect(host.textContent).toContain('Policy Pro is coming');
  });

  it('End goes to Lookups, Home goes back, Left wraps around', async () => {
    await press('End');
    expect(selected()?.textContent).toBe('Lookups');
    await press('Home');
    expect(selected()?.textContent).toBe('Watchlist');
    await press('ArrowLeft');
    expect(selected()?.textContent).toBe('Lookups');
  });

  it('only the selected tab is in the tab order and every tab names the panel', () => {
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    for (const tab of tabs()) expect(tab.getAttribute('aria-controls')).toBe(panel()?.id);
  });
});
