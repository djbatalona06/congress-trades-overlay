import type { BargoTrade, BudgetState, CongressTrade } from '@/lib/types';

export const DAY = '2026-10-07';
export const NOON = Date.parse(`${DAY}T12:00:00Z`);
export const HOUR = 60 * 60 * 1000;

export function bargoTrade(overrides: Partial<BargoTrade> = {}): BargoTrade {
  return {
    member: 'Nancy Pelosi',
    member_slug: 'nancy-pelosi',
    chamber: 'house',
    state: 'CA11',
    ticker: 'NVDA',
    asset: 'NVIDIA Corporation - Common Stock',
    type: 'purchase',
    amount_low: 1001,
    amount_high: 15000,
    amount_range: '$1,001 - $15,000',
    transaction_date: '2026-08-18',
    disclosure_date: '2026-09-10',
    filing_portal: 'https://disclosures-clerk.house.gov/FinancialDisclosure',
    ...overrides,
  };
}

export function congressTrade(overrides: Partial<CongressTrade> = {}): CongressTrade {
  return {
    id: 'nancy-pelosi|NVDA|purchase|2026-08-18|1001',
    member: 'Nancy Pelosi',
    memberSlug: 'nancy-pelosi',
    party: 'D',
    chamber: 'house',
    state: 'CA11',
    ticker: 'NVDA',
    type: 'purchase',
    amount: '$1,001 - $15,000',
    transactionDate: '2026-08-18',
    filedDate: '2026-09-10',
    sourceUrl: 'https://disclosures-clerk.house.gov/FinancialDisclosure',
    ...overrides,
  };
}

export function budget(overrides: Partial<BudgetState> = {}): BudgetState {
  return {
    day: DAY,
    requestsLimit: 30,
    requestsRemaining: 30,
    rowsLimit: 100,
    rowsRemaining: 100,
    ...overrides,
  };
}
