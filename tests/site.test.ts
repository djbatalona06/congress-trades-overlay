import { existsSync, readFileSync, rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('site/dist/index.html', 'utf8');
const css = readFileSync('site/dist/styles.css', 'utf8');
const BROKERS = [
  ['TradingView', 'https://www.tradingview.com/', true],
  ['Robinhood', 'https://robinhood.com/', true],
  ['Webull', 'https://www.webull.com/', true],
  ['Charles Schwab', 'https://www.schwab.com/', true],
  ['Interactive Brokers', 'https://www.interactivebrokers.com/', false],
  ['SoFi', 'https://www.sofi.com/', false],
  ['Fidelity', 'https://www.fidelity.com/', false],
  ['E*TRADE', 'https://www.etrade.com/', false],
  ['Vanguard', 'https://investor.vanguard.com/', false],
  ['Public', 'https://public.com/', false],
] as const;

const brokerSection = html.slice(html.indexOf('class="brokers"'), html.indexOf('<!-- 4. Capabilities'));
const anchors = (source: string) => [...source.matchAll(/<a\s[^>]*>/g)].map((m) => m[0]);

describe('broker links on the site', () => {
  it('has a row for every broker, linking to the company home page', () => {
    for (const [name, url] of BROKERS) {
      expect(brokerSection, name).toContain(`href="${url}"`);
    }
  });

  it('opens each link in a new tab safely, with a screen-reader note', () => {
    const links = anchors(brokerSection);
    expect(links).toHaveLength(BROKERS.length);
    for (const tag of links) {
      expect(tag).toContain('target="_blank"');
      expect(tag).toContain('rel="noopener noreferrer"');
    }
    expect(brokerSection.match(/\(opens in a new tab\)/g)).toHaveLength(BROKERS.length);
  });

  it('adds no affiliate codes, tracking parameters or redirects', () => {
    for (const [, url] of BROKERS) {
      const links = [...html.matchAll(new RegExp(`href="(${url.replace(/[./]/g, '\\$&')}[^"]*)"`, 'g'))];
      expect(links.length).toBeGreaterThan(0);
      for (const [, href] of links) expect(href).toBe(url);
    }
  });

  it('is honest: only the four supported brokers say they work; every other broker says it is not supported', () => {
    for (const [name, , supported] of BROKERS) {
      const escaped = name.replace(/[*]/g, '\\*');
      const item = brokerSection.match(new RegExp(`<li><a [^>]*>(?:<img [^>]*>)?${escaped}[\\s\\S]*?</li>`))?.[0] ?? '';
      expect(item, name).not.toBe('');
      if (supported) expect(item).toContain('Works with Capitol Tape');
      else expect(item).toContain('not supported by the extension yet');
    }
  });

  it('lists the same links in the footer, IBKR marked as not supported', () => {
    const footer = html.slice(html.indexOf('<h3>Platforms</h3>'), html.indexOf('<h3>Resources</h3>'));
    for (const [, url] of BROKERS) expect(footer).toContain(`href="${url}"`);
    expect(footer).toContain('not supported yet');
  });

  it('wraps the cards and centres the last row, so no card is left alone at the edge', () => {
    const rule = css.match(/\.broker-list \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('flex-wrap: wrap');
    expect(rule).toContain('justify-content: center');
  });

  it('gives every broker a logo file that exists', () => {
    const logos = [...brokerSection.matchAll(/<img src="(logos\/[a-z]+\.svg)" alt=""/g)].map((m) => m[1]);
    expect(logos).toHaveLength(BROKERS.length);
    for (const file of logos) expect(existsSync(`site/dist/${file}`), file).toBe(true);
  });

  it('names every broker in the not-affiliated sentence', () => {
    const sentence = html.match(/<p>Capitol Tape is not affiliated[^<]*<\/p>/)?.[0] ?? '';
    expect(sentence).not.toBe('');
    for (const [name] of BROKERS) {
      expect(sentence, name).toContain(name);
    }
  });
});

const PAGES = ['index', 'pricing', 'login', 'account', 'privacy', 'terms', 'data', 'security', 'faq', 'changelog'] as const;
const page = (name: string) => readFileSync(`site/dist/${name}.html`, 'utf8');
const header = (source: string) => source.slice(source.indexOf('<header'), source.indexOf('</header>'));

describe('site pages', () => {
  it('share one header with the sub-links and the grid menu', () => {
    const reference = header(page('index'));
    expect(reference).toContain('href="pricing.html"');
    expect(reference).toContain('href="login.html"');
    expect(reference).toContain('class="menu-btn"');
    for (const name of PAGES) expect(header(page(name)), name).toBe(reference);
  });

  it('keep CSS and scripts in their own files, not inside the HTML', () => {
    for (const name of PAGES) {
      const source = page(name).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
      expect(source, name).toContain('href="styles.css"');
      expect(source, name).not.toMatch(/<style[\s>]/);
      expect(source, name).not.toMatch(/<script>/);
    }
  });

  it('load the config before the shared script, and every script file exists', () => {
    for (const name of PAGES) {
      const source = page(name);
      const scripts = [...source.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
      expect(scripts.slice(0, 2), name).toEqual(['config.js', 'site.js']);
      for (const file of scripts) expect(existsSync(`site/dist/${file}`), `${name}: ${file}`).toBe(true);
    }
  });

  it('every Add to Chrome button is wired to the desktop-only check', () => {
    expect(readFileSync('site/dist/site.js', 'utf8')).toContain("document.querySelectorAll('[data-install]')");
    expect(readFileSync('site/dist/site.js', 'utf8')).toContain('Desktop only');
    expect(page('index').match(/data-install="chrome"/g)!.length).toBeGreaterThanOrEqual(3);
    expect(page('index')).toMatch(/Not available on mobile/);
  });

  it('offer Google and GitHub sign-in', () => {
    const login = page('login');
    expect(login).toContain('data-provider="google"');
    expect(login).toContain('data-provider="github"');
    expect(login).toContain('Continue with Google');
    expect(login).toContain('Continue with GitHub');
  });
});

describe('site build', () => {
  const src = (path: string) => readFileSync(`site/src/${path}`, 'utf8');

  it('page sources pull in the shared header and footer instead of copying them', () => {
    for (const path of ['pages/index.html', 'pages/pricing.html', 'pages/login.html', 'pages/account.html', 'legal/privacy.html']) {
      expect(src(path), path).toContain('<!-- @include Header -->');
      expect(src(path), path).toContain('<!-- @include FooterLegal -->');
      expect(src(path), path).not.toContain('<header');
    }
  });

  it('leaves no include markers or {{values}} in the built pages', () => {
    for (const name of PAGES) {
      expect(page(name), name).not.toContain('@include');
      expect(page(name), name).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it('writes config.js from env vars, with nothing filled in by default', async () => {
    const { buildSite } = await import('../scripts/build-site.mjs');
    const out = 'site/dist-env-test';
    try {
      buildSite({ out, env: { SITE_CHROME_URL: 'https://store.example/item', SITE_AUTH_BASE: 'https://api.example/', SITE_CONTACT_EMAIL: 'team@capitol.example' } });
      const config = readFileSync(`${out}/config.js`, 'utf8');
      expect(config).toContain('"chrome": "https://store.example/item"');
      expect(config).toContain('"AUTH_BASE": "https://api.example"');
      expect(readFileSync(`${out}/index.html`, 'utf8')).toContain('mailto:team@capitol.example');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    expect(readFileSync('site/dist/config.js', 'utf8')).toContain('"chrome": ""');
  });
});

describe('brand and visual system', () => {
  const hero = (source: string) => source.slice(source.indexOf('<section class="hero"'), source.indexOf('</section>', source.indexOf('<section class="hero"')));

  it('the hero has one headline, one subhead and one primary button', () => {
    const block = hero(page('index'));
    expect(block.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(block.match(/class="sub /g)).toHaveLength(1);
    expect(block.match(/class="btn btn-primary"/g)).toHaveLength(1);
    expect(block).toContain('Nonpartisan congressional trade data, right on your chart.');
  });

  it('every signal box pairs an icon with the level word', () => {
    const boxes = [...page('index').matchAll(/<p class="signal signal-(quiet|watch|hot)">([\s\S]*?)<\/p>/g)];
    expect(new Set(boxes.map((m) => m[1]))).toEqual(new Set(['quiet', 'watch', 'hot']));
    for (const [, level, inner] of boxes) {
      expect(inner, level).toContain(`<use href="#sig-${level}"`);
      expect(inner, level).toMatch(new RegExp(`<b>${level}</b>`, 'i'));
    }
    for (const level of ['quiet', 'watch', 'hot']) expect(page('index')).toContain(`<symbol id="sig-${level}"`);
  });

  it('does not colour party badges by party', () => {
    expect(page('index')).not.toMatch(/class="badge b-[dri]"/);
    expect(css).not.toMatch(/\.b-[dr]\s*\{/);
  });

  it('uses navy, not green or red, for buttons, links and focus', () => {
    const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.:-]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule('.btn-primary')).toContain('var(--navy)');
    expect(rule(':focus-visible')).toContain('var(--navy)');
    expect(css).not.toMatch(/--green|--red/);
  });

  it('keeps pages free of inline style attributes', () => {
    for (const name of PAGES.filter((n) => n !== 'index')) expect(page(name), name).not.toMatch(/\sstyle="/);
    expect(page('index').replace(/<figure class="quote[\s\S]*?<\/figure>/g, '')).not.toMatch(/\sstyle="/);
  });
});

describe('legal and trust pages', () => {
  const footer = (source: string) => source.slice(source.indexOf('<footer'), source.indexOf('</footer>'));

  it('every page has the same footer, with the full legal row and no placeholder links', () => {
    const reference = footer(page('index'));
    for (const href of ['privacy.html', 'terms.html', 'data.html', 'security.html', 'faq.html', 'changelog.html']) {
      expect(reference, href).toContain(`href="${href}"`);
    }
    expect(reference).toContain('href="mailto:');
    expect(reference).not.toContain('href="#"');
    for (const name of PAGES) expect(footer(page(name)), name).toBe(reference);
  });

  it('says "not financial advice" on every page', () => {
    for (const name of PAGES) expect(page(name), name).toMatch(/not financial advice/i);
  });

  it('the data page covers the source, the delay, accuracy, liability and the use limits', () => {
    const data = page('data');
    for (const phrase of ['Bargo', '45 days', 'not responsible for errors, omissions', 'Not financial advice', '13107(c)']) {
      expect(data, phrase).toContain(phrase);
    }
  });

  it('the terms disclaim advice and warranties and limit liability', () => {
    const terms = page('terms');
    for (const phrase of ['Not advice', 'provided "as is"', 'Limit of liability', 'ExtensionPay and Stripe', '13107(c)']) {
      expect(terms, phrase).toContain(phrase);
    }
  });

  it('the security page lists exactly the permissions the extension asks for', () => {
    const config = readFileSync('wxt.config.ts', 'utf8');
    const permissions = JSON.parse(config.match(/permissions: (\[[^\]]*\])/)![1].replace(/'/g, '"')) as string[];
    for (const permission of permissions) expect(page('security'), permission).toContain(`<code>${permission}</code>`);
  });

  it('the privacy page has a real contact link, not a placeholder', () => {
    expect(page('privacy')).not.toContain('[publisher contact email]');
    expect(page('privacy')).toMatch(/href="mailto:[^"]+@[^"]+"/);
  });

  it('the FAQ explains how to add a Bargo key, step by step', () => {
    const faq = page('faq');
    expect(faq).toContain('id="bargo-key"');
    expect(faq).toContain('bargo.ai/connect');
    expect(faq).toMatch(/<ol class="howto">[\s\S]*Lookups[\s\S]*Save[\s\S]*<\/ol>/);
  });

  it('the home page shows the trust strip', () => {
    const strip = page('index').slice(page('index').indexOf('class="trust-strip"'));
    for (const fact of ['No brokerage access', 'Public filings only', 'Delayed by law', 'Not financial advice']) expect(strip, fact).toContain(fact);
  });
});
