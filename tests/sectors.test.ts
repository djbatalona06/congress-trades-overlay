import { describe, expect, it } from 'vitest';
import {
  SECTOR_POLICY_AREAS,
  TICKERS_BY_SECTOR,
  type Sector,
  policyAreasFor,
  sectorFor,
  textMatchesSector,
} from '../worker/src/sectors';

// The fixed list Congress.gov assigns bills from. A typo in the sector map
// would silently match nothing, so every mapped name is checked against it.
const CONGRESS_GOV_POLICY_AREAS = new Set([
  'Agriculture and Food',
  'Animals',
  'Armed Forces and National Security',
  'Arts, Culture, Religion',
  'Civil Rights and Liberties, Minority Issues',
  'Commerce',
  'Congress',
  'Crime and Law Enforcement',
  'Economics and Public Finance',
  'Education',
  'Emergency Management',
  'Energy',
  'Environmental Protection',
  'Families',
  'Finance and Financial Sector',
  'Foreign Trade and International Finance',
  'Government Operations and Politics',
  'Health',
  'Housing and Community Development',
  'Immigration',
  'International Affairs',
  'Labor and Employment',
  'Law',
  'Native Americans',
  'Public Lands and Natural Resources',
  'Science, Technology, Communications',
  'Social Sciences and History',
  'Social Welfare',
  'Sports and Recreation',
  'Taxation',
  'Transportation and Public Works',
  'Water Resources Development',
]);

const SECTORS = Object.keys(SECTOR_POLICY_AREAS) as Sector[];

describe('sectorFor', () => {
  it('maps well-known tickers to their sector', () => {
    expect(sectorFor('LMT')).toBe('Industrials');
    expect(sectorFor('NVDA')).toBe('Information Technology');
    expect(sectorFor('XOM')).toBe('Energy');
    expect(sectorFor('JPM')).toBe('Financials');
    expect(sectorFor('NEE')).toBe('Utilities');
  });

  it('ignores case and treats BRK-B and BRK.B as one share class', () => {
    expect(sectorFor('nvda')).toBe('Information Technology');
    expect(sectorFor('BRK-B')).toBe('Financials');
    expect(sectorFor('BRK.B')).toBe('Financials');
  });

  it('returns null instead of guessing for a ticker it does not know', () => {
    expect(sectorFor('ZZZZ')).toBeNull();
    expect(sectorFor('')).toBeNull();
  });

  it('gives every seeded ticker exactly one sector', () => {
    const seen = new Map<string, Sector>();
    for (const sector of SECTORS) {
      for (const ticker of TICKERS_BY_SECTOR[sector].split(' ')) {
        expect(seen.get(ticker), `${ticker} is listed under two sectors`).toBeUndefined();
        seen.set(ticker, sector);
        expect(sectorFor(ticker)).toBe(sector);
      }
    }
  });
});

describe('policyAreasFor', () => {
  it('links defense to the armed-forces policy area and utilities to water', () => {
    expect(policyAreasFor('Industrials')).toContain('Armed Forces and National Security');
    expect(policyAreasFor('Utilities')).toContain('Water Resources Development');
    expect(policyAreasFor('Energy')).toContain('Energy');
  });

  it('only uses policy-area names Congress.gov actually assigns', () => {
    for (const sector of SECTORS) {
      expect(policyAreasFor(sector).length).toBeGreaterThan(0);
      for (const area of policyAreasFor(sector)) {
        expect(CONGRESS_GOV_POLICY_AREAS.has(area), `${sector}: "${area}"`).toBe(true);
      }
    }
  });
});

describe('textMatchesSector', () => {
  it('matches whole words and phrases, ignoring case', () => {
    expect(textMatchesSector('Energy', 'Unleashing American OIL and Gas production')).toBe(true);
    expect(textMatchesSector('Materials', 'Securing the supply of rare earth magnets')).toBe(true);
    expect(textMatchesSector('Financials', 'Guaranteeing access to digital asset payments')).toBe(true);
  });

  it('does not match inside longer words', () => {
    expect(textMatchesSector('Energy', 'Tourism in Las Vegas')).toBe(false);
    expect(textMatchesSector('Industrials', 'Restoring the trail network')).toBe(false);
    expect(textMatchesSector('Utilities', 'Empowering the workforce')).toBe(false);
  });

  it('is false for text about something else', () => {
    expect(textMatchesSector('Information Technology', 'Regarding school lunches')).toBe(false);
  });
});
