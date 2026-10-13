// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Popup } from '@/entrypoints/popup/Popup';
import type { RefreshResult } from '@/lib/extpay';

const refreshPro = vi.fn<() => Promise<RefreshResult>>();
vi.mock('@/lib/extpay', () => ({
  createExtPay: () => ({ openPaymentPage: vi.fn(), openLoginPage: vi.fn() }),
  refreshPro: () => refreshPro(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AT = new Date('2026-10-13T12:00:00Z').getTime();
let host: HTMLElement;
let root: Root;

const buttons = () => [...host.querySelectorAll('button')].map((b) => b.textContent);
const status = () => host.querySelector('[role="tabpanel"] [role="status"]')?.textContent ?? '';

async function openPlan(result: RefreshResult) {
  refreshPro.mockResolvedValue(result);
  await act(async () => root.render(<Popup />));
  const plan = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (tab) => tab.textContent === 'Plan',
  );
  await act(async () => plan?.click());
}

beforeEach(() => {
  fakeBrowser.reset();
  refreshPro.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('Plan tab states', () => {
  it('Pro, confirmed: says so with the time and offers Manage subscription', async () => {
    await openPlan({ ok: true, paid: true, checkedAt: AT });
    expect(status()).toContain('Pro is active. Last checked');
    expect(buttons()).toContain('Manage subscription');
    expect(buttons()).not.toContain('Upgrade to Pro');
    expect(host.querySelector('header .badge')?.textContent).toBe('Pro');
  });

  it('Free, confirmed: offers Upgrade and Log in', async () => {
    await openPlan({ ok: true, paid: false, checkedAt: AT });
    expect(status()).toContain('Free plan. Last checked');
    expect(buttons()).toEqual(expect.arrayContaining(['Upgrade to Pro', 'Already paid? Log in']));
    expect(host.textContent).toContain('Pro, $8/month');
  });

  it('check failed with a cached Pro: says so and offers Try again', async () => {
    await openPlan({ ok: false, cachedPaid: true, checkedAt: AT });
    expect(status()).toContain("Couldn't reach the payment server. Showing Pro from");
    expect(buttons()).toContain('Try again');
    expect(host.querySelector('header .badge')?.textContent).toBe('Pro');
  });

  it('check failed with no cache: says so and offers Try again', async () => {
    await openPlan({ ok: false, cachedPaid: false, checkedAt: null });
    expect(status()).toContain("Couldn't check your plan. Check your connection and try again.");
    expect(buttons()).toContain('Try again');
  });

  it('Try again re-checks in place and redraws', async () => {
    await openPlan({ ok: false, cachedPaid: false, checkedAt: null });
    refreshPro.mockResolvedValue({ ok: true, paid: true, checkedAt: AT });
    const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Try again');
    await act(async () => retry?.click());
    expect(refreshPro).toHaveBeenCalledTimes(2);
    expect(status()).toContain('Pro is active');
  });
});
