import type { Platform, ResolvedTicker } from '../types';
import { resolveTicker } from '../ticker';
import { detectRobinhood } from './robinhood';
import { detectSchwab } from './schwab';
import { detectTradingView } from './tradingview';
import { detectWebull } from './webull';

type Detector = (url: URL, doc: Document) => string | null;

const DETECTORS: { platform: Platform; host: RegExp; detect: Detector }[] = [
  { platform: 'tradingview', host: /(^|\.)tradingview\.com$/, detect: detectTradingView },
  { platform: 'robinhood', host: /^robinhood\.com$/, detect: detectRobinhood },
  { platform: 'webull', host: /^www\.webull\.com$/, detect: detectWebull },
  { platform: 'schwab', host: /^www\.schwab\.com$/, detect: detectSchwab },
];

export const CONTENT_SCRIPT_MATCHES = [
  '*://*.tradingview.com/*',
  '*://robinhood.com/*',
  '*://www.webull.com/*',
  '*://www.schwab.com/*',
];

export interface Detection extends ResolvedTicker {
  platform: Platform;
}

export function detect(url: URL, doc: Document): Detection | null {
  const entry = DETECTORS.find((d) => d.host.test(url.hostname));
  if (!entry) return null;
  const resolved = resolveTicker(entry.detect(url, doc));
  return resolved ? { ...resolved, platform: entry.platform } : null;
}
