import { lookupParty } from './party';
import type { BargoTrade, Chamber, CongressTrade, TradeType } from './types';

const CHAMBERS: readonly string[] = ['house', 'senate'];
const TYPES: readonly string[] = ['purchase', 'sale', 'exchange'];

export const HOUSE_SEARCH_URL = 'https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch';
export const SENATE_SEARCH_URL = 'https://efdsearch.senate.gov/search/';

export interface RecordLink {
  url: string;
  label: string;
}

// Bargo's filing_portal is the portal home today; a single filing is a PDF or an eFD view page.
const isSpecificFiling = (url: string) =>
  /\.pdf$/i.test(url) || /efdsearch\.senate\.gov\/search\/view\//.test(url);

function chamberOf(trade: Pick<CongressTrade, 'chamber' | 'sourceUrl'>): Chamber | null {
  if (trade.chamber) return trade.chamber;
  if (trade.sourceUrl?.includes('senate.gov')) return 'senate';
  if (trade.sourceUrl?.includes('house.gov')) return 'house';
  return null;
}

/** Where to read the official record of a trade. Never empty. */
export function officialRecordLinks(trade: Pick<CongressTrade, 'chamber' | 'sourceUrl'>): RecordLink[] {
  const url = trade.sourceUrl;
  if (url?.startsWith('https://') && isSpecificFiling(url)) return [{ url, label: 'Official record' }];
  const chamber = chamberOf(trade);
  if (chamber === 'house') return [{ url: HOUSE_SEARCH_URL, label: 'Search official records' }];
  if (chamber === 'senate') return [{ url: SENATE_SEARCH_URL, label: 'Search official records' }];
  return [
    { url: HOUSE_SEARCH_URL, label: 'House records' },
    { url: SENATE_SEARCH_URL, label: 'Senate records' },
  ];
}

export const TYPE_LABEL: Record<TradeType, string> = {
  purchase: 'Buy',
  sale: 'Sell',
  exchange: 'Exchange',
};

/** Bargo rows carry no id, so one is derived from the fields that identify a filing line. */
function tradeId(raw: BargoTrade, ticker: string): string {
  return [raw.member_slug, ticker, raw.type, raw.transaction_date, raw.amount_low].join('|');
}

/**
 * Maps a Bargo response. A member can file several identical lines for one day
 * (same ticker, type and amount range); repeats get a "#n" suffix so each row
 * keeps its own id.
 */
export function toCongressTrades(raws: BargoTrade[], fallbackTicker: string): CongressTrade[] {
  const occurrences = new Map<string, number>();
  return raws.map((raw) => {
    const trade = toCongressTrade(raw, fallbackTicker);
    const count = (occurrences.get(trade.id) ?? 0) + 1;
    occurrences.set(trade.id, count);
    return count === 1 ? trade : { ...trade, id: `${trade.id}#${count}` };
  });
}

function toCongressTrade(raw: BargoTrade, fallbackTicker: string): CongressTrade {
  const member = raw.member?.trim() || 'Unknown member';
  const chamber = CHAMBERS.includes(raw.chamber ?? '') ? (raw.chamber as Chamber) : null;
  const ticker = raw.ticker?.toUpperCase() || fallbackTicker;
  return {
    id: tradeId(raw, ticker),
    member,
    memberSlug: raw.member_slug ?? '',
    party: lookupParty(chamber, raw.state, member),
    chamber,
    state: raw.state,
    ticker,
    type: TYPES.includes(raw.type ?? '') ? (raw.type as TradeType) : null,
    amount: raw.amount_range?.trim() || 'Amount not disclosed',
    transactionDate: raw.transaction_date,
    filedDate: raw.disclosure_date,
    sourceUrl: raw.filing_portal?.startsWith('https://') ? raw.filing_portal : null,
  };
}
