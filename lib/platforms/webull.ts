// "/quote/nasdaq-nvda": venue, then the symbol with dots written as hyphens.
const QUOTE_PAGE = /^\/quote\/([a-z0-9]+)-([a-z0-9-]+)\/?$/i;

export function detectWebull(url: URL): string | null {
  const [, venue, symbol] = QUOTE_PAGE.exec(url.pathname) ?? [];
  if (!venue || !symbol) return null;
  return `${venue}:${symbol.replace(/-/g, '.')}`;
}
