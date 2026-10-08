import { ROWS_PER_LOOKUP } from './budget';
import type { BudgetState, Party } from './types';

const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-09-10" -> "Sep 10, 2026". Disclosure dates have no time zone, so they are read as UTC. */
export function formatDate(isoDay: string | null): string {
  if (!isoDay) return 'Unknown';
  const time = Date.parse(`${isoDay.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(time) ? 'Unknown' : DATE.format(time);
}

export const PARTY_NAME: Record<Party, string> = {
  D: 'Democrat',
  R: 'Republican',
  I: 'Independent',
};

/** Chart lookups the remaining request and row budgets can still pay for. */
export function lookupsLeft(budget: BudgetState): number {
  return Math.min(budget.requestsRemaining, Math.floor(budget.rowsRemaining / ROWS_PER_LOOKUP));
}

export function lookupsPerDay(budget: BudgetState): number {
  return Math.min(budget.requestsLimit, Math.floor(budget.rowsLimit / ROWS_PER_LOOKUP));
}
