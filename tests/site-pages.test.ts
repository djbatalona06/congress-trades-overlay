import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(`site/${name}`, 'utf8');
const PAGES = ['index.html', 'privacy.html', 'terms.html', 'support.html', 'changelog.html'];

describe('site pages', () => {
  it('every page exists and has a title, description and canonical or is the policy page', () => {
    for (const page of PAGES) {
      const html = read(page);
      expect(html, page).toMatch(/<title>[^<]+<\/title>/);
      expect(html, page).toContain('<html lang="en">');
    }
    for (const page of PAGES.filter((p) => p !== 'privacy.html')) {
      expect(read(page), page).toContain('rel="canonical"');
      expect(read(page), page).toContain('name="description"');
    }
  });

  it('the home page has no dead links, no fake contact address, no invented people', () => {
    const html = read('index.html');
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('example.com');
    for (const name of ['Dana Reyes', 'Marcus Tran', 'Priya Shah']) expect(html).not.toContain(name);
  });

  it('local links on the home page point at files that exist', () => {
    const html = read('index.html');
    const targets = [...html.matchAll(/href="([a-z-]+\.html)(#[\w-]+)?"/g)].map((m) => m[1] as string);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of new Set(targets)) expect(existsSync(`site/${target}`), target).toBe(true);
  });

  it('has the social card, sitemap and robots file that search and sharing need', () => {
    const html = read('index.html');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('content="summary_large_image"');
    expect(existsSync('site/og-image.png')).toBe(true);
    expect(read('robots.txt')).toContain('Sitemap: https://capitol-tape.pages.dev/sitemap.xml');
    const sitemap = read('sitemap.xml');
    for (const page of PAGES.filter((p) => p !== 'index.html')) expect(sitemap).toContain(`/${page}`);
  });

  it('the Desk tier is labelled as not available yet', () => {
    expect(read('index.html')).toContain('Not available yet');
  });

  it('adds no analytics script to any page', () => {
    for (const page of PAGES) {
      const html = read(page);
      expect(html, page).not.toMatch(/googletagmanager|google-analytics|gtag\(|plausible|mixpanel/i);
    }
  });

  it('the privacy page names the Google Fonts request and has no placeholder', () => {
    const html = read('privacy.html');
    expect(html).toContain('Google Fonts');
    expect(html).not.toContain('[publisher contact email]');
  });

  it('the changelog and the in-app release note agree on the version', async () => {
    const { RELEASE_NOTES } = await import('@/lib/update');
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
    expect(RELEASE_NOTES[version]).toBeTruthy();
    expect(read('changelog.html')).toContain(`Version ${version}`);
  });
});
