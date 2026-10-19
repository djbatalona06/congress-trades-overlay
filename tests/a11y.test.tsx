// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import axe from 'axe-core';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Hud } from '@/entrypoints/overlay.content/Hud';
import { Overlay } from '@/entrypoints/overlay.content/Overlay';
import { Panel } from '@/entrypoints/panel/Panel';
import { Popup } from '@/entrypoints/popup/Popup';
import { setCurrentTicker, setLastSeen } from '@/lib/settings';
import type { TradesResponse } from '@/lib/types';
import { budget, congressTrade } from './helpers';

const TRADES: TradesResponse = {
  status: 'ok',
  ticker: 'NVDA',
  trades: [congressTrade()],
  fetchedAt: Date.now(),
  stale: false,
  fromNetwork: true,
  budget: budget(),
};
vi.mock('@/lib/messaging', () => ({
  requestTrades: async () => TRADES,
  requestPopOut: vi.fn(),
}));

vi.mock('@/lib/extpay', () => ({
  createExtPay: () => ({ openPaymentPage: vi.fn(), openLoginPage: vi.fn() }),
  refreshPro: vi.fn(async () => ({ ok: false, cachedPaid: false, checkedAt: null })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- Contrast, computed from the real stylesheets (WCAG 1.4.6, 1.4.11) ----

const POPUP_CSS = readFileSync('entrypoints/popup/style.css', 'utf8');
const PANEL_CSS = readFileSync('entrypoints/overlay.content/style.css', 'utf8');
const POPOUT_CSS = readFileSync('entrypoints/panel/style.css', 'utf8');
const TRADES_CSS = readFileSync('components/trades.css', 'utf8');
const HUD_CSS = readFileSync('entrypoints/overlay.content/hud.css', 'utf8');

function token(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`token ${name} not found`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AAA_TEXT = 7;
const NON_TEXT = 3;

describe.each([
  ['popup', POPUP_CSS, ['--muted', '--text', '--link', '--accent-text', '--error']],
  ['panel', PANEL_CSS, ['--muted', '--text', '--link', '--buy', '--sell']],
  ['pop-out', POPOUT_CSS, ['--muted', '--text', '--link', '--buy', '--sell']],
] as const)('%s colour contrast', (_name, css, textTokens) => {
  const backgrounds = [token(css, '--bg'), token(css, '--bg-raised')];

  for (const name of textTokens) {
    it(`${name} is at least ${AAA_TEXT}:1 on both backgrounds`, () => {
      for (const bg of backgrounds) {
        expect(contrast(token(css, name), bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(AAA_TEXT);
      }
    });
  }

  for (const name of ['--control-border', '--link']) {
    it(`${name} (control edge / focus ring) is at least ${NON_TEXT}:1 on both backgrounds`, () => {
      for (const bg of backgrounds) {
        expect(contrast(token(css, name), bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(NON_TEXT);
      }
    });
  }
});

describe('other coloured text', () => {
  it('primary button text is at least 7:1 on the accent fill', () => {
    expect(contrast(token(POPUP_CSS, '--on-accent'), token(POPUP_CSS, '--accent'))).toBeGreaterThanOrEqual(AAA_TEXT);
  });

  it('white party-badge text is at least 7:1 on each badge colour', () => {
    for (const party of ['D', 'R', 'I']) {
      const block = TRADES_CSS.match(new RegExp(`\\.party-${party}\\s*\\{[^}]*background:\\s*(#[0-9a-fA-F]{6})`));
      expect(block?.[1], `party-${party}`).toBeTruthy();
      expect(contrast('#ffffff', block?.[1] as string), `party-${party}`).toBeGreaterThanOrEqual(AAA_TEXT);
    }
  });
});

describe('signal HUD colour contrast', () => {
  const hudBackgrounds = [token(HUD_CSS, '--hud-bg'), token(HUD_CSS, '--hud-raised')];

  for (const name of ['--hud-text', '--hud-muted', '--hud-link', '--hud-quiet', '--hud-watch', '--hud-hot']) {
    it(`${name} is at least ${AAA_TEXT}:1 on both HUD backgrounds`, () => {
      for (const bg of hudBackgrounds) {
        expect(contrast(token(HUD_CSS, name), bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(AAA_TEXT);
      }
    });
  }

  it('the dark text on a pressed chip is at least 7:1 on every level colour', () => {
    for (const name of ['--hud-quiet', '--hud-watch', '--hud-hot']) {
      expect(contrast(token(HUD_CSS, '--hud-bg'), token(HUD_CSS, name)), name).toBeGreaterThanOrEqual(AAA_TEXT);
    }
  });

  it('control edges (--hud-control) are at least 3:1 on both HUD backgrounds', () => {
    for (const bg of hudBackgrounds) {
      expect(contrast(token(HUD_CSS, '--hud-control'), bg), bg).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  it('every control is at least 44x44 CSS px', () => {
    expect(HUD_CSS).toMatch(/\.hud-grip \{[^}]*width: 44px;[^}]*height: 44px/s);
    expect(HUD_CSS).toMatch(/\.hud-ring \{[^}]*width: 44px;[^}]*height: 44px/s);
    expect(HUD_CSS).toMatch(/\.chip \{[^}]*min-height: 44px/s);
  });
});

describe('stylesheets', () => {
  it('both turn motion off for prefers-reduced-motion', () => {
    for (const css of [POPUP_CSS, PANEL_CSS, POPOUT_CSS, HUD_CSS]) {
      expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
      expect(css).toMatch(/transition: none !important/);
    }
  });

  it('buttons are at least 44x44 CSS px', () => {
    expect(POPUP_CSS).toMatch(/button \{[^}]*min-width: 44px;[^}]*min-height: 44px/s);
    expect(PANEL_CSS).toMatch(/\.close,\s*\.popout \{[^}]*width: 44px;[^}]*height: 44px/s);
    expect(PANEL_CSS).toMatch(/\.toggle \{[^}]*min-height: 44px/s);
    expect(PANEL_CSS).toMatch(/\.edge-tab \{[^}]*width: 44px;[^}]*min-height: 44px/s);
    expect(TRADES_CSS).toMatch(/\.watch-button \{[^}]*min-height: 44px/s);
  });
});

// ---- axe-core on the rendered popup, every tab ----

// Rules axe cannot judge here. Each needs a reason; keep this list short.
const KNOWN_EXCEPTIONS: { rule: string; reason: string }[] = [
  {
    rule: 'color-contrast-enhanced',
    reason: 'jsdom has no layout or CSS, so axe cannot compute colours; the token tests above cover them.',
  },
  {
    rule: 'color-contrast',
    reason: 'Same as above (AA variant).',
  },
];

let host: HTMLElement;
let root: Root;

beforeEach(async () => {
  fakeBrowser.reset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Popup />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function violations() {
  const results = await axe.run(host, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'wcag2aaa'] },
    rules: Object.fromEntries(KNOWN_EXCEPTIONS.map(({ rule }) => [rule, { enabled: false }])),
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
}

describe('axe (WCAG 2.2 A, AA and AAA rules)', () => {
  for (const label of ['Watchlist', 'Plan', 'Lookups']) {
    it(`${label} tab has no violations`, async () => {
      const tab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent === label);
      await act(async () => tab?.click());
      expect(await violations()).toEqual([]);
    });
  }
});

describe('axe on the page panel and the pop-out window', () => {
  it('the edge tab and the opened drawer have no violations', async () => {
    await act(async () =>
      root.render(<Overlay detection={{ platform: 'tradingview', ticker: 'NVDA', bond: null }} response={TRADES} />),
    );
    expect(await violations()).toEqual([]);
    await act(async () => host.querySelector<HTMLElement>('.edge-tab')?.click());
    expect(host.querySelector('.drawer')).toBeTruthy();
    expect(await violations()).toEqual([]);
  });

  it('the opened Influence section has no violations and names its sources', async () => {
    const withInfluence: TradesResponse = {
      ...TRADES,
      context: {
        related_bills: [],
        exec_orders: [],
        lobbying: [{ registrant: 'Big Firm LLP', client: 'Acme', issue_codes: ['DEF'], amount: 120000, period: '2026 Q3', date: '2026-10-08', url: 'https://lda.senate.gov/x' }],
        tax_flags: [{ bill_id: '119-hr-1', section_cite: '26 U.S.C. 45X', url: 'https://www.congress.gov/bill/119th-congress/house-bill/1' }],
        ie_spend: [
          {
            committee_id: 'C001',
            committee_name: 'Some Committee',
            member_slug: 'nancy-pelosi',
            candidate_name: 'Nancy Pelosi',
            support_or_oppose: 'support',
            amount: 5000,
            date: '2026-09-01',
            url: 'https://docs.fec.gov/x',
          },
        ],
      },
    };
    await act(async () =>
      root.render(<Overlay detection={{ platform: 'tradingview', ticker: 'NVDA', bond: null }} response={withInfluence} />),
    );
    await act(async () => host.querySelector<HTMLElement>('.edge-tab')?.click());
    const details = host.querySelector<HTMLDetailsElement>('details.influence');
    expect(details?.querySelector('summary')?.textContent).toBe('Influence (3)');
    details?.setAttribute('open', '');
    expect(details?.textContent).toContain('Some Committee reported $5,000 to support Nancy Pelosi');
    expect(details?.querySelectorAll('a[href^="https://"]')).toHaveLength(3);
    expect(details?.textContent).toContain('Big Firm LLP for Acme, 2026 Q3, $120,000 (DEF)');
    expect(await violations()).toEqual([]);
  });

  it('the pop-out window has no violations, empty and with trades', async () => {
    await act(async () => root.render(<Panel />));
    expect(await violations()).toEqual([]);
    await act(async () => {
      await setCurrentTicker({ ticker: 'NVDA', bond: null, platform: 'tradingview', at: Date.now() });
    });
    expect(host.textContent).toContain('Nancy Pelosi');
    expect(await violations()).toEqual([]);
  });
});

describe('axe on the signal HUD', () => {
  const hotTrade = (n: number) =>
    congressTrade({ id: `h${n}`, memberSlug: `m${n}`, member: `Member ${n}`, party: n === 2 ? 'R' : 'D' });
  const response: TradesResponse = {
    ...TRADES,
    trades: [hotTrade(1), hotTrade(2), hotTrade(3)],
  };

  it('has no violations expanded, with a signal picked, and collapsed', async () => {
    // Fixed clock so the fixture trades (Aug-Sep 2026) count as recent.
    const now = Date.parse('2026-09-12T12:00:00Z');
    await act(async () => root.render(<Hud ticker="NVDA" response={response} now={now} />));
    expect(host.querySelector('.hud')).toBeTruthy();
    expect(await violations()).toEqual([]);

    await act(async () => host.querySelector<HTMLElement>('.chip')?.click());
    expect(host.querySelector('.chip[aria-pressed="true"]')).toBeTruthy();
    expect(await violations()).toEqual([]);

    await act(async () => host.querySelector<HTMLElement>('.hud-ring')?.click());
    expect(host.querySelector('.chips')).toBeNull();
    expect(await violations()).toEqual([]);
  });
});

describe('axe on the update card', () => {
  it('has no violations while the card is showing', async () => {
    await setLastSeen({ version: '0.9.0', at: Date.now() });
    await act(async () => root.render(<Popup />));
    expect(host.querySelector('.gate')).toBeTruthy();
    expect(await violations()).toEqual([]);
  });
});
