import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BARGO_KEY_URL } from '@/lib/bargo';

// Pro is paused (spec 2026-10-18). Store and README copy must not sell anything.
const COPY_FILES = ['CHROMEWEBSTORE.md', 'README.md'] as const;

function readText(path: string): string {
  const raw = readFileSync(path, 'utf8');
  // Strip tags so "<b>$8</b><span>/month</span>" reads as "$8/month".
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

describe('copy sells nothing while Pro is paused', () => {
  for (const file of COPY_FILES) {
    it(`${file} states no price, no ticker limit and no upgrade`, () => {
      const text = readText(file);
      expect(text, `${file} price`).not.toMatch(/\$\d+\/month/);
      expect(text, `${file} free limit`).not.toMatch(/3 tickers/);
      expect(text, `${file} upgrade`).not.toMatch(/upgrade to pro/i);
    });
  }
});

describe('Bargo key copy', () => {
  it('the key link is the one agreed URL', () => {
    expect(BARGO_KEY_URL).toBe('https://www.bargo.ai/connect');
  });

  for (const file of ['README.md', 'site/index.html'] as const) {
    it(`${file} links to bargo.ai/connect`, () => {
      expect(readFileSync(file, 'utf8'), file).toContain('bargo.ai/connect');
    });
  }

  it('the site does not say no key is needed, and says the key is optional', () => {
    const raw = readFileSync('site/index.html', 'utf8');
    expect(raw).not.toMatch(/no api key/i);
    expect(readText('site/index.html')).toContain('A free Bargo key is optional');
  });

  it('the popup Lookups tab links to bargo.ai/connect', () => {
    const source = readFileSync('entrypoints/popup/Popup.tsx', 'utf8');
    expect(source).toContain('href={BARGO_KEY_URL}');
  });
});
