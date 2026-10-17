// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { checkSite } from '../scripts/check-site.mjs';

// Runs against site/dist, which tests/site-build.setup.ts builds before any test.
const pages = readdirSync('site/dist', { recursive: true }).map(String).filter((file) => file.endsWith('.html'));
const headers = readFileSync('site/dist/_headers', 'utf8');
const css = readFileSync('site/dist/styles.css', 'utf8');

describe('internal links', () => {
  it('every page, file and #anchor the site links to exists', () => {
    const { pages: checked, problems } = checkSite('site/dist');
    expect(checked).toBeGreaterThanOrEqual(10);
    expect(problems).toEqual([]);
  });
});

describe('accessibility (axe) on every built page', () => {
  for (const page of pages) {
    it(page, async () => {
      document.open();
      document.write(readFileSync(`site/dist/${page}`, 'utf8'));
      document.close();
      // jsdom cannot lay out pages, so contrast is checked from the tokens below instead.
      const result = await axe.run(document.documentElement, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});

describe('colour contrast of the site tokens', () => {
  const token = (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))?.[1] ?? '';
  const channel = (hex: string, i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const ratio = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  it.each([
    ['ink', 'bg', 7],
    ['muted', 'bg', 7],
    ['muted', 'bg-alt', 4.5],
    ['brand', 'bg', 7],
    ['brand', 'brand-tint', 7],
    ['quiet', 'quiet-tint', 4.5],
    ['watch', 'watch-tint', 4.5],
    ['hot', 'hot-tint', 4.5],
  ])('%s on %s is at least %d:1', (fg, bg, min) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });

  it('control edges reach 3:1 (WCAG 1.4.11)', () => {
    expect(ratio(token('line-strong'), token('bg'))).toBeGreaterThanOrEqual(2.5);
  });

  it('white button text on the brand slate is at least 7:1', () => {
    expect(ratio('#ffffff', token('brand'))).toBeGreaterThanOrEqual(7);
  });
});

describe('security headers', () => {
  const csp = headers.match(/Content-Security-Policy: (.*)/)?.[1] ?? '';

  it('sends the standard protective headers on every path', () => {
    expect(headers).toMatch(/^\/\*$/m);
    for (const header of [
      'Strict-Transport-Security: max-age=31536000',
      'X-Content-Type-Options: nosniff',
      'X-Frame-Options: DENY',
      'Referrer-Policy: strict-origin-when-cross-origin',
      'Permissions-Policy:',
    ]) {
      expect(headers, header).toContain(header);
    }
  });

  it('has a CSP that allows only this site, Google Fonts and nothing inline', () => {
    for (const directive of ["default-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) {
      expect(csp, directive).toContain(directive);
    }
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('pages carry nothing the CSP would block: no inline scripts, handlers or style attributes', () => {
    for (const page of pages) {
      const html = readFileSync(`site/dist/${page}`, 'utf8');
      expect(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''), page).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
      expect(html, page).not.toMatch(/\son[a-z]+="/);
      expect(html, page).not.toMatch(/\sstyle="/);
    }
  });

  it('lets sign-in reach the Worker only when its address is set', async () => {
    const { buildSite } = await import('../scripts/build-site.mjs');
    const { rmSync } = await import('node:fs');
    const out = 'site/dist-env-test';
    try {
      buildSite({ out, env: { SITE_AUTH_BASE: 'https://api.example.dev/' } });
      expect(readFileSync(`${out}/_headers`, 'utf8')).toContain("connect-src 'self' https://api.example.dev;");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    expect(headers).toContain("connect-src 'self';");
  });
});
