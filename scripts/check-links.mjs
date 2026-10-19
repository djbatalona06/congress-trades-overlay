// Opens every external link on the built site's pages (broker row, footer), plus the Bargo key link.
// Run on a machine with normal internet access: npm run check:links
import { readdirSync, readFileSync } from 'node:fs';

const html = readdirSync('site/dist', { recursive: true }).filter((file) => file.endsWith('.html')).map((file) => readFileSync(`site/dist/${file}`, 'utf8')).join('\n');
const urls = new Set(['https://www.bargo.ai/connect']);
for (const [, href] of html.matchAll(/<a href="(https:\/\/[^"]+)" target="_blank"/g)) urls.add(href);

let failed = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (link check)' },
      signal: AbortSignal.timeout(20_000),
    });
    // 403 usually means the site blocks scripts, not that the page is gone: open it by hand.
    const bad = res.status === 404 || res.status >= 500;
    const note = res.status === 403 ? ' (blocks scripts: open it by hand)' : '';
    console.log(`${bad ? 'FAIL' : 'ok  '} ${res.status} ${url}${res.url !== url ? ` -> ${res.url}` : ''}${note}`);
    if (bad) failed++;
  } catch (error) {
    console.log(`FAIL ---  ${url} (${error instanceof Error ? error.message : error})`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
