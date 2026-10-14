import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('site/index.html', 'utf8');
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
      const item = brokerSection.match(new RegExp(`<li><a [^>]*>${escaped}[\\s\\S]*?</li>`))?.[0] ?? '';
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
    const rule = html.match(/\.broker-list \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('flex-wrap: wrap');
    expect(rule).toContain('justify-content: center');
  });

  it('names every broker in the not-affiliated sentence', () => {
    const sentence = html.match(/<p>Capitol Tape is not affiliated[^<]*<\/p>/)?.[0] ?? '';
    expect(sentence).not.toBe('');
    for (const [name] of BROKERS) {
      expect(sentence, name).toContain(name);
    }
  });
});
