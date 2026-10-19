// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Hud } from '@/entrypoints/overlay.content/Hud';
import {
  getHudCollapsed,
  getHudEnabled,
  getHudPosition,
  setHudCollapsed,
  setHudEnabled,
  setHudPosition,
} from '@/lib/settings';
import type { CongressTrade, TradesResponse } from '@/lib/types';
import { NOON, budget, congressTrade } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOON - n * DAY_MS).toISOString().slice(0, 10);

let counter = 0;
function trade(overrides: Partial<CongressTrade> = {}): CongressTrade {
  counter += 1;
  return congressTrade({
    id: `t${counter}`,
    memberSlug: `member-${counter}`,
    member: `Member ${counter}`,
    transactionDate: daysAgo(20),
    filedDate: daysAgo(3),
    ...overrides,
  });
}

function response(trades: CongressTrade[], overrides: Partial<TradesResponse> = {}): TradesResponse {
  return {
    status: 'ok',
    ticker: 'NVDA',
    trades,
    fetchedAt: NOON,
    stale: false,
    fromNetwork: true,
    budget: budget(),
    ...overrides,
  };
}

// Three members, both parties, one big, one fresh: 3 + 2 + 1 + 1 = 7 -> Hot.
const HOT = () => [
  trade({ party: 'D' }),
  trade({ party: 'R' }),
  trade({ party: 'D', amount: '$500,001 - $1,000,000' }),
];

let host: HTMLElement;
let root: Root;

async function render(tradesResponse: TradesResponse) {
  await act(async () => {
    root.render(<Hud ticker="NVDA" response={tradesResponse} now={NOON} />);
  });
}

const hud = () => host.querySelector<HTMLElement>('.hud');
const text = () => host.textContent ?? '';
const grip = () => host.querySelector<HTMLButtonElement>('.hud-grip');
const ring = () => host.querySelector<HTMLButtonElement>('.hud-ring');
const chip = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.chip')].find((button) => button.textContent?.startsWith(label));

async function press(element: Element | null, key: string, shiftKey = false) {
  await act(async () => {
    element?.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  });
}

async function pointer(element: Element | null, type: string, x: number, y: number) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
  });
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

describe('Hud: what it shows', () => {
  it('shows the level, the ticker and the lit signals', async () => {
    await render(response(HOT()));
    expect(hud()?.classList.contains('hud-hot')).toBe(true);
    expect(text()).toContain('Hot');
    expect(text()).toContain('NVDA');
    expect(chip('Cluster buy')).toBeTruthy();
    expect(chip('Both parties buying')).toBeTruthy();
    expect(chip('Big trade')).toBeTruthy();
    expect(host.querySelector('.hud-score')?.textContent).toBe('7');
  });

  it('is calm when nothing is unusual', async () => {
    await render(response([trade({ filedDate: daysAgo(30) })]));
    expect(hud()?.classList.contains('hud-quiet')).toBe(true);
    expect(text()).toContain('Quiet');
    expect(text()).toContain('Nothing unusual');
  });

  it('pairs each level word with its own shape, so colour is never the only cue', async () => {
    const icon = () => host.querySelector('.hud-level .hud-level-icon');
    await render(response(HOT()));
    expect(icon()?.getAttribute('data-level')).toBe('hot');
    expect(icon()?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.hud-level')?.textContent).toBe('Hot');
    const hotShape = icon()?.innerHTML;

    await render(response([trade({ filedDate: daysAgo(30) })]));
    expect(icon()?.getAttribute('data-level')).toBe('quiet');
    expect(host.querySelector('.hud-level')?.textContent).toBe('Quiet');
    expect(icon()?.innerHTML).not.toBe(hotShape);

    await render(response([trade({ party: 'D' }), trade({ party: 'R' })]));
    expect(icon()?.getAttribute('data-level')).toBe('watch');
    expect(host.querySelector('.hud-level')?.textContent).toBe('Watch');
  });

  it('always carries the Bargo credit and the not-advice note', async () => {
    await render(response(HOT()));
    const credit = host.querySelector<HTMLAnchorElement>('a.hud-credit');
    expect(credit?.href).toContain('bargo.ai');
    expect(text()).toContain('Not advice');
  });

  it('stays out of the way with no trades, on an error, or when switched off', async () => {
    await render(response([]));
    expect(hud()).toBeNull();
    await render(response(HOT(), { status: 'error' }));
    expect(hud()).toBeNull();

    await setHudEnabled(false);
    await render(response(HOT()));
    expect(hud()).toBeNull();
  });

  it('hides live when the popup switch is turned off', async () => {
    await render(response(HOT()));
    expect(hud()).toBeTruthy();
    await act(async () => setHudEnabled(false));
    expect(hud()).toBeNull();
    await act(async () => setHudEnabled(true));
    expect(hud()).toBeTruthy();
  });
});

describe('Hud: signals', () => {
  it('shows the reason when a signal is pressed, and clears it when pressed again', async () => {
    await render(response(HOT()));
    expect(host.querySelector('.hud-detail')?.textContent).toContain('Tap a signal');

    await act(async () => chip('Cluster buy')?.click());
    expect(chip('Cluster buy')?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.hud-detail')?.textContent).toContain('3 different members bought');

    await act(async () => chip('Cluster buy')?.click());
    expect(chip('Cluster buy')?.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('.hud-detail')?.textContent).toContain('Tap a signal');
  });

  it('draws a no-points signal as information only', async () => {
    await render(response([trade({ transactionDate: daysAgo(80), filedDate: daysAgo(34) })]));
    expect(chip('Filed late')?.classList.contains('chip-info')).toBe(true);
  });
});

describe('Hud: collapsing', () => {
  it('collapses to the ring, keeps the credit visible, and remembers the choice', async () => {
    await render(response(HOT()));
    expect(ring()?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => ring()?.click());
    expect(ring()?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.chips')).toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('a.hud-credit')?.textContent).toBe('via Bargo');
    expect(await getHudCollapsed()).toBe(true);
  });

  it('starts collapsed when it was left collapsed', async () => {
    await setHudCollapsed(true);
    await render(response(HOT()));
    expect(hud()?.classList.contains('hud-collapsed')).toBe(true);
  });
});

describe('Hud: moving', () => {
  it('starts at the default spot, bottom left', async () => {
    await render(response(HOT()));
    expect(hud()?.style.left).toBe('16px');
    expect(hud()?.style.bottom).toBe('16px');
  });

  it('moves with the arrow keys, further with Shift, and saves the spot', async () => {
    await render(response(HOT()));
    await press(grip(), 'ArrowRight');
    await press(grip(), 'ArrowUp', true);
    expect(hud()?.style.left).toBe('32px');
    expect(hud()?.style.bottom).toBe('80px');
    expect(await getHudPosition()).toEqual({ left: 32, bottom: 80 });
  });

  it('ignores other keys', async () => {
    await render(response(HOT()));
    await press(grip(), 'Enter');
    expect(await getHudPosition()).toBeNull();
  });

  it('follows a drag and saves where it was dropped', async () => {
    await render(response(HOT()));
    await pointer(grip(), 'pointerdown', 100, 100);
    await pointer(grip(), 'pointermove', 140, 70);
    expect(hud()?.style.left).toBe('56px');
    expect(hud()?.style.bottom).toBe('46px');
    await pointer(grip(), 'pointerup', 140, 70);
    expect(await getHudPosition()).toEqual({ left: 56, bottom: 46 });
  });

  it('cannot be dragged off the screen', async () => {
    await render(response(HOT()));
    await pointer(grip(), 'pointerdown', 100, 100);
    await pointer(grip(), 'pointermove', -5000, 5000);
    await pointer(grip(), 'pointerup', -5000, 5000);
    expect(await getHudPosition()).toEqual({ left: 8, bottom: 8 });
  });

  it('comes back where it was left', async () => {
    await setHudPosition({ left: 200, bottom: 120 });
    await render(response(HOT()));
    expect(hud()?.style.left).toBe('200px');
    expect(hud()?.style.bottom).toBe('120px');
  });

  it('ignores a damaged saved spot', async () => {
    await fakeBrowser.storage.local.set({ hudPosition: { left: 'far', bottom: NaN } });
    await render(response(HOT()));
    expect(hud()?.style.left).toBe('16px');
  });
});

describe('HUD settings', () => {
  it('is on by default', async () => {
    expect(await getHudEnabled()).toBe(true);
    expect(await getHudCollapsed()).toBe(false);
    expect(await getHudPosition()).toBeNull();
  });
});
