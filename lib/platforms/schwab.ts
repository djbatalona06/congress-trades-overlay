// "/research/stocks/quotes/summary/nvda". The quote itself renders in a
// cross-origin iframe, so the top-level URL is the only place to read it.
const QUOTE_PAGE = /^\/research\/(?:stocks|etfs)\/quotes\/[^/]+\/([^/]+)/i;

export function detectSchwab(url: URL): string | null {
  const symbol = QUOTE_PAGE.exec(url.pathname)?.[1];
  if (symbol) return decodeURIComponent(symbol);
  return url.pathname.startsWith('/research/') ? url.searchParams.get('symbol') : null;
}
