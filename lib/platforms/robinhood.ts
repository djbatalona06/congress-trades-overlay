// "/stocks/NVDA" and the localized "/us/en/stocks/NVDA". ETFs share the path.
const STOCK_PAGE = /^\/(?:[a-z]{2}\/[a-z]{2}\/)?stocks\/([^/]+)/i;

export function detectRobinhood(url: URL): string | null {
  const symbol = STOCK_PAGE.exec(url.pathname)?.[1];
  return symbol ? decodeURIComponent(symbol) : null;
}
