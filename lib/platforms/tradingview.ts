const SYMBOL_PAGE = /^\/symbols\/([^/]+)\/?/;
const CHART_PAGE = /^\/chart(\/|$)/;
// Chart titles read "NVDA 237.47 ▼ −0.74%".
const CHART_TITLE = /^(\S+)\s+[\d.,]+\s/;

function shortSymbol(full: string): string {
  return full.slice(full.indexOf(':') + 1).toUpperCase();
}

export function detectTradingView(url: URL, doc: Document): string | null {
  const symbolPage = SYMBOL_PAGE.exec(url.pathname)?.[1];
  if (symbolPage) {
    // "/symbols/NASDAQ-NVDA/" — the venue never contains a hyphen, the symbol may.
    const slug = decodeURIComponent(symbolPage);
    const dash = slug.indexOf('-');
    return dash === -1 ? slug : `${slug.slice(0, dash)}:${slug.slice(dash + 1)}`;
  }

  if (!CHART_PAGE.test(url.pathname)) return null;

  const param = url.searchParams.get('symbol');
  const header = doc.querySelector('#header-toolbar-symbol-search')?.textContent?.trim();
  const live = header || CHART_TITLE.exec(doc.title)?.[1] || null;
  if (!live) return param;
  // The ?symbol= param keeps its original value after an in-chart symbol
  // switch, so it is only used for its venue when it still matches the chart.
  if (param && shortSymbol(param) === live.toUpperCase()) return param;
  return live;
}
