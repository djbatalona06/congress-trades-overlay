import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FREE_WATCHLIST_LIMIT, PRO_PRICE_MONTHLY } from '@/lib/watchlist';

// Store listing and site copy are written by hand. These tests fail, naming the
// file, when that copy drifts from the constants the code uses.
const FILES = ['CHROMEWEBSTORE.md', 'README.md', 'site/index.html'] as const;

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
