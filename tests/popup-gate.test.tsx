// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Overlay } from '@/entrypoints/overlay.content/Overlay';
import { Popup } from '@/entrypoints/popup/Popup';
import { getLastSeen, setLastSeen } from '@/lib/settings';
import type { TradesResponse } from '@/lib/types';
import { budget, congressTrade } from './helpers';

vi.mock('@/lib/extpay', () => ({
  createExtPay: () => ({ openPaymentPage: vi.fn(), openLoginPage: vi.fn() }),
  refreshPro: vi.fn(async () => ({ ok: true, paid: false, checkedAt: Date.now() })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 24 * 60 * 60 * 1000;
const VERSION = fakeBrowser.runtime.getManifest().version;
const TRADES: TradesResponse = {
  status: 'ok',
  ticker: 'NVDA',
  trades: [congressTrade()],
  fetchedAt: Date.now(),
  stale: false,
  fromNetwork: true,
  budget: budget(),
};

let host: HTMLElement;
let root: Root;
const gate = () => host.querySelector('.gate');
const button = (label: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === label);

async function renderPopup() {
  await act(async () => root.render(<Popup />));
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

describe('update gate in the popup', () => {
  it('shows after an update, with the version and a note, and Continue records it', async () => {
    await setLastSeen({ version: '0.9.0', at: Date.now() });
    await renderPopup();
    expect(gate()?.textContent).toContain(`Updated to version ${VERSION}`);
    expect(gate()?.textContent).toContain('What changed:');
    await act(async () => button('Continue')?.click());
    expect(gate()).toBeNull();
    expect(await getLastSeen()).toMatchObject({ version: VERSION });
  });

  it('shows "Welcome back" after more than 14 idle days on the same version', async () => {
    await setLastSeen({ version: VERSION, at: Date.now() - 15 * DAY });
    await renderPopup();
    expect(gate()?.textContent).toContain('Welcome back');
  });

  it('stays hidden within 14 days, and on a first run just writes a record', async () => {
    await setLastSeen({ version: VERSION, at: Date.now() - 2 * DAY });
    await renderPopup();
    expect(gate()).toBeNull();

    await act(async () => root.unmount());
    fakeBrowser.reset();
    root = createRoot(host);
    await renderPopup();
    expect(gate()).toBeNull();
    expect(await getLastSeen()).toMatchObject({ version: VERSION });
  });

  it('hides "Check for updates" where the browser cannot check (Firefox)', async () => {
    await setLastSeen({ version: '0.9.0', at: Date.now() });
    const runtime = fakeBrowser.runtime as { requestUpdateCheck?: unknown };
    runtime.requestUpdateCheck = undefined;
    await renderPopup();
    expect(button('Check for updates')).toBeUndefined();
  });

  it('on Chrome, reports the result of the update check', async () => {
    await setLastSeen({ version: '0.9.0', at: Date.now() });
    const check = vi.fn(async () => ({ status: 'update_available' }));
    Object.assign(fakeBrowser.runtime, { requestUpdateCheck: check });
    await renderPopup();
    await act(async () => button('Check for updates')?.click());
    expect(check).toHaveBeenCalled();
    expect(gate()?.textContent).toContain('An update is ready. Restart Chrome to finish.');
  });
});

describe('update dot on the panel', () => {
  const edgeTab = () => host.querySelector<HTMLElement>('.edge-tab');

  it('shows a dot with a tooltip until the notes are acknowledged', async () => {
    await setLastSeen({ version: '0.9.0', at: Date.now() });
    await act(async () =>
      root.render(<Overlay detection={{ platform: 'tradingview', ticker: 'NVDA', bond: null }} response={TRADES} />),
    );
    expect(edgeTab()?.querySelector('.dot')).toBeTruthy();
    expect(edgeTab()?.title).toBe('Update notes: open the Capitol Tape popup');
    expect(host.textContent).not.toContain('What changed');

    await act(async () => {
      await setLastSeen({ version: VERSION, at: Date.now() });
    });
    expect(edgeTab()?.querySelector('.dot')).toBeNull();
  });

  it('has no dot for a user who is up to date', async () => {
    await setLastSeen({ version: VERSION, at: Date.now() });
    await act(async () =>
      root.render(<Overlay detection={{ platform: 'tradingview', ticker: 'NVDA', bond: null }} response={TRADES} />),
    );
    expect(edgeTab()?.querySelector('.dot')).toBeNull();
  });
});
