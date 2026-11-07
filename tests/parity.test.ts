import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BARGO_KEY_URL } from '@/lib/bargo';
import { WAITLIST_URL } from '@/lib/site';

// Pro is paused (spec 2026-10-18). Store, README and every website source page must not sell anything.
const SITE_SOURCES = readdirSync('site/src', { recursive: true })
  .map(String)
  .filter((file) => file.endsWith('.html'))
  .map((file) => `site/src/${file.split('\\').join('/')}`)
  .sort();
const COPY_FILES = ['CHROMEWEBSTORE.md', 'README.md', ...SITE_SOURCES];

function readText(path: string): string {
  const raw = readFileSync(path, 'utf8');
  // Strip tags so "<b>$8</b><span>/month</span>" reads as "$8/month".
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

// The stripped text alone would hide copy inside include comments, like a Head description.
function readCopy(path: string): string {
  return `${readFileSync(path, 'utf8').replace(/\s+/g, ' ')} ${readText(path)}`;
}

describe('copy sells nothing while Pro is paused', () => {
  it('reads every website source page, not only the built home page', () => {
    expect(SITE_SOURCES).toContain('site/src/pages/pricing.html');
    expect(SITE_SOURCES).toContain('site/src/pages/extension/index.html');
    expect(SITE_SOURCES).toContain('site/src/components/Header.html');
  });

  for (const file of COPY_FILES) {
    it(`${file} states no price, no ticker limit and no upgrade`, () => {
      const text = readCopy(file);
      expect(text, `${file} price`).not.toMatch(/\$\d+\s*\/\s*month/);
      expect(text, `${file} old Pro price`).not.toMatch(/\$8(?![\d,])/);
      expect(text, `${file} per month`).not.toMatch(/\/month/);
      expect(text, `${file} free limit`).not.toMatch(/3 tickers/);
      expect(text, `${file} upgrade`).not.toMatch(/upgrade to pro/i);
      expect(text, `${file} Upgrade`).not.toMatch(/\bUpgrade\b/);
    });
  }
});

describe('the waitlist page the popup links to', () => {
  const built = `site/dist${new URL(WAITLIST_URL).pathname}index.html`;

  it('is built, with the waitlist anchor and form', () => {
    expect(built).toBe('site/dist/extension/index.html');
    const raw = readFileSync(built, 'utf8');
    expect(raw).toContain(`id="${new URL(WAITLIST_URL).hash.slice(1)}"`);
    expect(raw).toContain('id="waitlist-form"');
    expect(raw).toContain('<script src="../waitlist.js"></script>');
  });

  it('uses the Plan tab sentence and sells nothing', () => {
    const raw = readFileSync(built, 'utf8');
    // The shared footer's disclaimer says "buy or sell"; only the page's own content must not sell.
    const main = raw.slice(raw.indexOf('<main'), raw.indexOf('</main>')).replace(/<[^>]+>/g, ' ');
    expect(main).toContain('Policy Pro is coming: alerts on bills and executive orders for your sectors.');
    expect(main).not.toMatch(/\bsubscribe\b|\bbuy\b|\$\d/i);
    expect(readText(built)).toMatch(/not financial advice/i);
  });
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
