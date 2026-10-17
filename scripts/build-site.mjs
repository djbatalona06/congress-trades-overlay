// Builds the website: site/src + site/public -> site/dist. No dependencies.
//
//   site/src/pages/   one file per page (nested folders keep their path)
//   site/src/legal/   privacy, terms and other legal pages (written to the top level)
//   site/src/components/   shared pieces, pulled in with <!-- @include Name key="value" -->
//   site/src/js, site/src/styles   copied to the top level, so URLs stay /site.js, /styles.css
//   site/src/_headers response headers for Cloudflare Pages (CSP and friends), filled in like a page
//   site/public/      copied as-is (logos, icon)
//
// A block include wraps content, which the component places with {{children}}:
//   <!-- @include PricingCard name="Pro" -->…list items…<!-- @end PricingCard -->
// Inside a component or page, {{key}} is replaced by an include argument or a site value.
// An unknown {{key}} or a missing component stops the build, so typos never ship.
//
// Site values come from env vars at build time. They are public: never put a secret here.
//   SITE_CHROME_URL, SITE_FIREFOX_URL   store listing links
//   SITE_AUTH_BASE                      Worker address for sign-in, no trailing slash
//   SITE_CONTACT_EMAIL                  contact address on every page
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ATTRS = `((?:\\s+[a-zA-Z]+=(?:"[^"]*"|'[^']*'))*)\\s*`;
const BLOCK = new RegExp(`<!-- @include ([A-Za-z]+)${ATTRS}-->([\\s\\S]*?)<!-- @end \\1 -->`, 'g');
const INCLUDE = new RegExp(`<!-- @include ([A-Za-z]+)${ATTRS}-->`, 'g');
// Arguments use double quotes, or single quotes when the value holds HTML with double quotes.
const ARG = /([a-zA-Z]+)=(?:"([^"]*)"|'([^']*)')/g;
const VAR = /\{\{([a-zA-Z]+)\}\}/g;

export function siteValues(env = process.env) {
  return {
    chromeUrl: env.SITE_CHROME_URL ?? '',
    firefoxUrl: env.SITE_FIREFOX_URL ?? '',
    authBase: (env.SITE_AUTH_BASE ?? '').replace(/\/+$/, ''),
    contactEmail: env.SITE_CONTACT_EMAIL || 'hello@example.com',
  };
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function render(source, vars, components, file, depth = 0) {
  if (depth > 8) throw new Error(`${file}: includes nest too deep`);
  const expand = (name, rawArgs, children) => {
    const part = components.get(name);
    if (part === undefined) throw new Error(`${file}: no component called ${name}`);
    const args = Object.fromEntries([...rawArgs.matchAll(ARG)].map(([, key, double, single]) => [key, double ?? single]));
    const childVars = children === undefined ? {} : { children: render(children, vars, components, file, depth + 1) };
    return render(part.replace(/\n$/, ''), { ...vars, ...args, ...childVars }, components, `${file} > ${name}`, depth + 1);
  };
  const included = source
    .replace(BLOCK, (_, name, rawArgs, children) => expand(name, rawArgs, children))
    .replace(INCLUDE, (_, name, rawArgs) => expand(name, rawArgs));
  return included.replace(VAR, (_, key) => {
    if (!(key in vars)) throw new Error(`${file}: {{${key}}} has no value`);
    return vars[key];
  });
}

export function buildSite({ root = 'site', out = join(root, 'dist'), env = process.env } = {}) {
  const src = join(root, 'src');
  const values = siteValues(env);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), out, { recursive: true });
  for (const folder of ['js', 'styles']) {
    for (const file of listFiles(join(src, folder))) cpSync(file, join(out, relative(join(src, folder), file)));
  }

  const components = new Map(
    listFiles(join(src, 'components'))
      .filter((file) => file.endsWith('.html'))
      .map((file) => [relative(join(src, 'components'), file).replace(/\.html$/, ''), readFileSync(file, 'utf8')]),
  );

  const pages = [];
  for (const folder of ['pages', 'legal']) {
    for (const file of listFiles(join(src, folder)).filter((f) => f.endsWith('.html'))) {
      const path = relative(join(src, folder), file).split(sep).join('/');
      // Pages in a sub-folder reach shared files with ../
      const base = '../'.repeat(path.split('/').length - 1);
      const html = render(readFileSync(file, 'utf8'), { ...values, base, path }, components, path);
      mkdirSync(dirname(join(out, path)), { recursive: true });
      writeFileSync(join(out, path), html);
      pages.push(path);
    }
  }

  // The Worker's origin is the only other place the site's scripts may connect to.
  const authOrigin = values.authBase ? ` ${new URL(values.authBase).origin}` : '';
  const headers = join(src, '_headers');
  if (existsSync(headers)) {
    writeFileSync(join(out, '_headers'), render(readFileSync(headers, 'utf8'), { ...values, authOrigin }, components, '_headers'));
  }

  writeFileSync(
    join(out, 'config.js'),
    `// Made by scripts/build-site.mjs from env vars at build time. Change those, not this file.\n` +
      `window.CAPITOL = ${JSON.stringify(
        { INSTALL_URLS: { chrome: values.chromeUrl, firefox: values.firefoxUrl }, AUTH_BASE: values.authBase },
        null,
        2,
      )};\n`,
  );
  return { out, pages: pages.sort() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { out, pages } = buildSite();
  console.log(`Built ${pages.length} pages into ${out}: ${pages.join(', ')}`);
}
