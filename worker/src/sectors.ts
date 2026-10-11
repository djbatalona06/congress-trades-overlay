/**
 * Bill -> sector -> ticker matching (spec decision D5).
 *
 * Congress.gov gives every bill one "policy area" from a fixed list of 32. Each
 * sector below lists the policy areas that plausibly touch its companies, and
 * a ticker belongs to one sector. The result is shown as "related legislation",
 * never as a claim about impact on the stock.
 */

export type Sector =
  | 'Communication Services'
  | 'Consumer Discretionary'
  | 'Consumer Staples'
  | 'Energy'
  | 'Financials'
  | 'Health Care'
  | 'Industrials'
  | 'Information Technology'
  | 'Materials'
  | 'Real Estate'
  | 'Utilities';

export const SECTOR_POLICY_AREAS: Record<Sector, readonly string[]> = {
  'Communication Services': ['Science, Technology, Communications', 'Arts, Culture, Religion'],
  'Consumer Discretionary': ['Commerce', 'Foreign Trade and International Finance', 'Sports and Recreation'],
  'Consumer Staples': ['Agriculture and Food', 'Foreign Trade and International Finance'],
  Energy: ['Energy', 'Environmental Protection', 'Public Lands and Natural Resources'],
  Financials: ['Finance and Financial Sector', 'Taxation', 'Economics and Public Finance'],
  'Health Care': ['Health', 'Social Welfare'],
  Industrials: [
    'Armed Forces and National Security',
    'Transportation and Public Works',
    'Commerce',
    'Labor and Employment',
    'Emergency Management',
  ],
  'Information Technology': ['Science, Technology, Communications', 'Foreign Trade and International Finance'],
  Materials: ['Public Lands and Natural Resources', 'Environmental Protection', 'Foreign Trade and International Finance'],
  'Real Estate': ['Housing and Community Development', 'Finance and Financial Sector', 'Taxation'],
  Utilities: ['Energy', 'Environmental Protection', 'Water Resources Development'],
};

/** Words that tie an executive order's title or abstract to a sector. */
const SECTOR_KEYWORDS: Record<Sector, readonly string[]> = {
  'Communication Services': ['telecommunications', 'broadband', 'spectrum', 'media', 'internet', 'social media'],
  'Consumer Discretionary': ['automobile', 'automotive', 'vehicle', 'retail', 'tourism', 'travel'],
  'Consumer Staples': ['food', 'agriculture', 'agricultural', 'farm', 'grocery', 'tobacco'],
  Energy: ['energy', 'oil', 'gas', 'petroleum', 'pipeline', 'drilling', 'coal'],
  Financials: ['bank', 'banking', 'financial', 'credit', 'securities', 'digital asset', 'cryptocurrency', 'insurance'],
  'Health Care': ['health', 'drug', 'pharmaceutical', 'medicare', 'medicaid', 'medical', 'vaccine', 'hospital'],
  Industrials: ['defense', 'military', 'aerospace', 'shipbuilding', 'aviation', 'rail', 'shipping', 'manufacturing'],
  'Information Technology': ['semiconductor', 'chip', 'artificial intelligence', 'software', 'cyber', 'computing', 'data center'],
  Materials: ['mining', 'mineral', 'minerals', 'steel', 'aluminum', 'copper', 'lithium', 'rare earth'],
  'Real Estate': ['housing', 'real estate', 'mortgage', 'rent', 'homeless'],
  Utilities: ['electric', 'electricity', 'grid', 'power', 'utility', 'nuclear', 'water'],
};

/**
 * Seed list of well-known US tickers and their GICS-style sector. A ticker that
 * is not here simply gets no related legislation; nothing is guessed.
 */
export const TICKERS_BY_SECTOR: Record<Sector, string> = {
  'Communication Services': 'GOOGL GOOG META NFLX DIS T VZ TMUS CMCSA CHTR EA TTWO WBD',
  'Consumer Discretionary': 'AMZN TSLA HD LOW MCD SBUX NKE F GM BKNG CCL RCL MAR ABNB LULU',
  'Consumer Staples': 'WMT COST TGT PG KO PEP PM MO CL KHC MDLZ GIS KR',
  Energy: 'XOM CVX COP OXY SLB EOG PSX MPC VLO HAL KMI WMB',
  Financials: 'JPM BAC WFC C GS MS V MA BRK.B AXP BLK SCHW PYPL COIN USB PNC',
  'Health Care': 'JNJ PFE MRK LLY ABBV UNH AMGN GILD BMY TMO ABT MDT CVS ISRG MRNA',
  Industrials: 'LMT RTX NOC GD BA CAT DE GE HON UPS UNP DAL UAL AAL LUV FDX LHX HII',
  'Information Technology': 'AAPL MSFT NVDA AMD INTC AVGO QCOM TXN MU ORCL CRM ADBE CSCO IBM NOW AMAT LRCX PLTR TSM',
  Materials: 'LIN FCX NEM DOW APD SHW ECL NUE',
  'Real Estate': 'AMT PLD O SPG EQIX PSA',
  Utilities: 'NEE DUK SO D AEP EXC SRE',
};

const TICKER_SECTORS: ReadonlyMap<string, Sector> = new Map(
  (Object.entries(TICKERS_BY_SECTOR) as [Sector, string][]).flatMap(([sector, list]) =>
    list.split(' ').map((ticker) => [ticker, sector] as const),
  ),
);

/** BRK-B and BRK.B are the same share class. */
function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace('-', '.');
}

export function sectorFor(ticker: string): Sector | null {
  return TICKER_SECTORS.get(normalizeTicker(ticker)) ?? null;
}

export function policyAreasFor(sector: Sector): readonly string[] {
  return SECTOR_POLICY_AREAS[sector];
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word match, so "gas" does not match "Las Vegas" and "rail" does not match "trail". */
export function textMatchesSector(sector: Sector, text: string): boolean {
  const haystack = text.toLowerCase();
  return SECTOR_KEYWORDS[sector].some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`).test(haystack));
}
