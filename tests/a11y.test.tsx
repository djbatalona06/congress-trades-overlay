// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import axe from 'axe-core';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Popup } from '@/entrypoints/popup/Popup';

vi.mock('@/lib/extpay', () => ({
  createExtPay: () => ({ openPaymentPage: vi.fn(), openLoginPage: vi.fn() }),
  refreshPro: vi.fn(async () => ({ ok: false, cachedPaid: false, checkedAt: null })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- Contrast, computed from the real stylesheets (WCAG 1.4.6, 1.4.11) ----

const POPUP_CSS = readFileSync('entrypoints/popup/style.css', 'utf8');
const PANEL_CSS = readFileSync('entrypoints/overlay.content/style.css', 'utf8');

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
      const block = PANEL_CSS.match(new RegExp(`\\.party-${party}\\s*\\{[^}]*background:\\s*(#[0-9a-fA-F]{6})`));
      expect(block?.[1], `party-${party}`).toBeTruthy();
      expect(contrast('#ffffff', block?.[1] as string), `party-${party}`).toBeGreaterThanOrEqual(AAA_TEXT);
    }
  });
});

describe('stylesheets', () => {
  it('both turn motion off for prefers-reduced-motion', () => {
    for (const css of [POPUP_CSS, PANEL_CSS]) {
      expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
      expect(css).toMatch(/transition: none !important/);
    }
  });

  it('buttons are at least 44x44 CSS px', () => {
    expect(POPUP_CSS).toMatch(/button \{[^}]*min-width: 44px;[^}]*min-height: 44px/s);
    expect(PANEL_CSS).toMatch(/\.close \{[^}]*width: 44px;[^}]*height: 44px/s);
    expect(PANEL_CSS).toMatch(/\.toggle \{[^}]*min-height: 44px/s);
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
