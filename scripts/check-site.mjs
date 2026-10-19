// Checks every link inside the built site (site/dist) without going online:
// each page, script, stylesheet and image it points to must exist, and each #anchor
// must match an id on the target page. Placeholder links (href="#" or empty) fail too.
// Run after the build: npm run check:site. External links are checked weekly by check-links.mjs.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ATTR = /\s(href|src)="([^"]*)"/g;
const SKIP = /^(https?:|mailto:|tel:|data:|javascript:)/;

export function checkSite(dir = 'site/dist') {
  const pages = readdirSync(dir, { recursive: true }).map(String).filter((file) => file.endsWith('.html'));
  const ids = new Map();
  const idsOf = (file) => {
    if (!ids.has(file)) ids.set(file, new Set([...readFileSync(join(dir, file), 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
    return ids.get(file);
  };

  const problems = [];
  for (const page of pages) {
    const html = readFileSync(join(dir, page), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const [, attr, value] of html.matchAll(ATTR)) {
      if (SKIP.test(value)) continue;
      if (value === '' || value === '#') {
        problems.push(`${page}: placeholder ${attr}="${value}"`);
        continue;
      }
      const [path, hash] = value.split('#');
      // An in-page anchor (#faq) or a link to a file next to this page.
      let target = page;
      if (path) {
        target = relative(dir, normalize(join(dir, dirname(page), path.split('?')[0])));
        const full = join(dir, target);
        if (!existsSync(full) || (statSync(full).isDirectory() && !existsSync(join(full, 'index.html')))) {
          problems.push(`${page}: ${attr}="${value}" points to a missing file`);
          continue;
        }
        if (statSync(full).isDirectory()) target = join(target, 'index.html');
      }
      if (hash && target.endsWith('.html') && !idsOf(target).has(hash)) {
        problems.push(`${page}: ${attr}="${value}" points to a missing #${hash}`);
      }
    }
  }
  return { pages: pages.length, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { pages, problems } = checkSite(process.argv[2]);
  for (const problem of problems) console.log(`FAIL ${problem}`);
  console.log(`${pages} pages checked, ${problems.length} broken link${problems.length === 1 ? '' : 's'}.`);
  process.exit(problems.length ? 1 : 0);
}
