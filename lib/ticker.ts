import type { ResolvedTicker } from './types';

// Venues that list US equities. A symbol from any other known venue is ignored:
// the same letters on a foreign exchange are a different company, and showing
// its "congress trades" would be wrong data.
const US_EQUITY_VENUES = new Set([
  'NASDAQ',
  'NYSE',
  'AMEX',
  'ARCA',
  'NYSEARCA',
  'NYSEAMERICAN',
  'NYSEMKT',
  'BATS',
  'CBOE',
  'IEX',
  'OTC',
  'OTCMKTS',
  'PINK',
]);
const BOND_VENUE = 'FINRA';

const EQUITY = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;
// FINRA:AAPL4242667 — issuer ticker followed by a numeric issue id.
const BOND_NUMBERED = /^([A-Z]{1,5})\d{6,8}$/;
// FINRA:MO.HA — issuer ticker with a two-letter issue suffix. Only trusted when
// the venue is known to be FINRA, since BRK.B has the same shape.
const BOND_SUFFIXED = /^([A-Z]{1,5})\.[A-Z]{2}$/;

export function isValidTicker(value: string): boolean {
  return EQUITY.test(value);
}

/** Accepts "NASDAQ:NVDA" or a bare "NVDA". */
function splitVenue(raw: string): { venue: string | null; symbol: string } {
  const value = raw.trim().toUpperCase();
  const colon = value.indexOf(':');
  if (colon === -1) return { venue: null, symbol: value };
  return { venue: value.slice(0, colon), symbol: value.slice(colon + 1) };
}

export function resolveTicker(raw: string | null | undefined): ResolvedTicker | null {
  if (!raw) return null;
  const { venue, symbol } = splitVenue(raw);
  if (!symbol) return null;

  const numbered = BOND_NUMBERED.exec(symbol)?.[1];
  if (numbered && (venue === null || venue === BOND_VENUE)) {
    return { ticker: numbered, bond: symbol };
  }
  if (venue === BOND_VENUE) {
    const suffixed = BOND_SUFFIXED.exec(symbol)?.[1];
    return suffixed ? { ticker: suffixed, bond: symbol } : null;
  }

  if (venue !== null && !US_EQUITY_VENUES.has(venue)) return null;
  return isValidTicker(symbol) ? { ticker: symbol, bond: null } : null;
}
