// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Popup } from '@/entrypoints/popup/Popup';
import type { RefreshResult } from '@/lib/extpay';
import { WAITLIST_URL } from '@/lib/site';

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

const waitlist = () => host.querySelector<HTMLAnchorElement>(`a[href="${WAITLIST_URL}"]`);

describe('Plan tab while Pro is paused', () => {
  it('free user: waitlist link, no Upgrade, no Log in, no price', async () => {
    await openPlan({ ok: true, paid: false, checkedAt: AT });
    expect(host.textContent).toContain('Policy Pro is coming');
    expect(waitlist()).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' });
    expect(buttons()).not.toContain('Upgrade to Pro');
    expect(buttons()).not.toContain('Already paid? Log in');
    expect(host.textContent).not.toMatch(/\$\d+\/month/);
  });

  it('paid user: active subscription with Manage subscription, plus the waitlist', async () => {
    await openPlan({ ok: true, paid: true, checkedAt: AT });
    expect(status()).toContain('You have an active subscription. Last checked');
    expect(buttons()).toContain('Manage subscription');
    expect(waitlist()).toBeTruthy();
  });

  it('paid user offline: says so and offers Try again', async () => {
    await openPlan({ ok: false, cachedPaid: true, checkedAt: AT });
    expect(status()).toContain("Couldn't reach the payment server. Showing your subscription from");
    expect(buttons()).toContain('Try again');
  });

  it('free user offline: no error, just the waitlist', async () => {
    await openPlan({ ok: false, cachedPaid: false, checkedAt: null });
    expect(status()).toBe('');
    expect(buttons()).not.toContain('Try again');
    expect(waitlist()).toBeTruthy();
  });

  it('Try again re-checks in place and redraws', async () => {
    await openPlan({ ok: false, cachedPaid: true, checkedAt: AT });
    refreshPro.mockResolvedValue({ ok: true, paid: true, checkedAt: AT });
    const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Try again');
    await act(async () => retry?.click());
    expect(refreshPro).toHaveBeenCalledTimes(2);
    expect(status()).toContain('You have an active subscription');
  });

  it('has no Free/Pro badge in the header', async () => {
    await openPlan({ ok: true, paid: true, checkedAt: AT });
    expect(host.querySelector('header .badge')).toBeNull();
  });
});
