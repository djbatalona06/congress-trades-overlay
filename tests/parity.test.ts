import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BARGO_KEY_URL } from '@/lib/bargo';
import { FREE_WATCHLIST_LIMIT, PRO_PRICE_MONTHLY } from '@/lib/watchlist';

// Store listing and site copy are written by hand. These tests fail, naming the
// file, when that copy drifts from the constants the code uses.
const FILES = ['CHROMEWEBSTORE.md', 'README.md', 'site/dist/index.html', 'site/dist/pricing.html'] as const;

function readText(path: string): string {
  const raw = readFileSync(path, 'utf8');
  // Strip tags so "<b>$8</b><span>/month</span>" reads as "$8/month".
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

describe('plan facts match the constants', () => {
  for (const file of FILES) {
    it(`${file} states the price, and every price it states matches`, () => {
      const prices = [...readText(file).matchAll(/\$(\d+)\/month/g)].map((m) => Number(m[1]));
      expect(prices.length, `${file} states no $N/month price`).toBeGreaterThan(0);
      expect(prices, `${file} price`).toEqual(prices.map(() => PRO_PRICE_MONTHLY));
    });
    it(`${file} states the free limit`, () => {
      expect(readText(file), `${file} free limit`).toContain(`${FREE_WATCHLIST_LIMIT} tickers`);
    });
  }
});

describe('Bargo key copy', () => {
  it('the key link is the one agreed URL', () => {
    expect(BARGO_KEY_URL).toBe('https://www.bargo.ai/connect');
  });

  for (const file of ['README.md', 'site/dist/index.html'] as const) {
    it(`${file} links to bargo.ai/connect`, () => {
      expect(readFileSync(file, 'utf8'), file).toContain('bargo.ai/connect');
    });
  }

  it('the site does not say no key is needed, and says the key is optional', () => {
    const raw = readFileSync('site/dist/index.html', 'utf8');
    expect(raw).not.toMatch(/no api key/i);
    expect(readText('site/dist/index.html')).toContain('A free Bargo key is optional');
  });

  it('the popup Lookups tab links to bargo.ai/connect', () => {
    const source = readFileSync('entrypoints/popup/Popup.tsx', 'utf8');
    expect(source).toContain('href={BARGO_KEY_URL}');
  });
});
