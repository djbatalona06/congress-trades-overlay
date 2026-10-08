import { storage } from 'wxt/utils/storage';
import type { RateSnapshot } from './bargo';
import type { BudgetState, RequestPurpose } from './types';

const KEY = 'local:budget';

export const KEYLESS_LIMITS = { requests: 30, rows: 100 };
export const KEYED_LIMITS = { requests: 100, rows: 1000 };
/** Rows requested per lookup; also what the collapsed header counts as "recent". */
export const ROWS_PER_LOOKUP = 5;

/** Share of the daily lookups that background alert checks may never dip into. */
const ALERT_SHARE = 0.5;

// Bargo's reset time is not documented and is not UTC midnight. When the local
// counters say "exhausted", one request per interval is let through to find out
// whether the server has reset; a 429 costs nothing.
const PROBE_INTERVAL_MS = 60 * 60 * 1000;

interface StoredBudget extends BudgetState {
  updatedAt: number;
}

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function fresh(hasKey: boolean, now: number): StoredBudget {
  const limits = hasKey ? KEYED_LIMITS : KEYLESS_LIMITS;
  return {
    day: utcDay(now),
    requestsLimit: limits.requests,
    requestsRemaining: limits.requests,
    rowsLimit: limits.rows,
    rowsRemaining: limits.rows,
    updatedAt: now,
  };
}

function isExhausted(budget: BudgetState): boolean {
  return budget.requestsRemaining < 1 || budget.rowsRemaining < ROWS_PER_LOOKUP;
}

function toState({ updatedAt: _updatedAt, ...state }: StoredBudget): BudgetState {
  return state;
}

export async function readBudget(hasKey: boolean, now = Date.now()): Promise<BudgetState> {
  const stored = await storage.getItem<StoredBudget>(KEY);
  if (!stored || stored.day !== utcDay(now)) return toState(fresh(hasKey, now));
  if (isExhausted(stored) && now - stored.updatedAt >= PROBE_INTERVAL_MS) {
    return {
      ...toState(stored),
      requestsRemaining: Math.max(stored.requestsRemaining, 1),
      rowsRemaining: Math.max(stored.rowsRemaining, ROWS_PER_LOOKUP),
    };
  }
  return toState(stored);
}

/**
 * Folds one successful response into the counters. Bargo's request counter
 * already includes the call that carried it; its row counter does not. Both
 * have been seen lagging a request behind, so the local count wins whenever it
 * is lower.
 */
export async function recordResponse(
  previous: BudgetState,
  rate: RateSnapshot,
  rowsReturned: number,
  now = Date.now(),
): Promise<BudgetState> {
  const requests = Math.min(rate.requestsRemaining ?? Infinity, previous.requestsRemaining - 1);
  const rows = Math.min(rate.rowsRemaining ?? Infinity, previous.rowsRemaining) - rowsReturned;
  const next: StoredBudget = {
    day: utcDay(now),
    requestsLimit: rate.requestsLimit ?? previous.requestsLimit,
    requestsRemaining: Math.max(0, requests),
    rowsLimit: rate.rowsLimit ?? previous.rowsLimit,
    rowsRemaining: Math.max(0, rows),
    updatedAt: now,
  };
  await storage.setItem(KEY, next);
  return toState(next);
}

export async function recordExhausted(previous: BudgetState, now = Date.now()): Promise<BudgetState> {
  const next: StoredBudget = {
    ...previous,
    day: utcDay(now),
    requestsRemaining: 0,
    updatedAt: now,
  };
  await storage.setItem(KEY, next);
  return toState(next);
}

/** Called when the user adds or removes their Bargo key: the limits change. */
export async function resetBudget(): Promise<void> {
  await storage.removeItem(KEY);
}

/** Chart lookups the remaining request and row budgets can still pay for. */
export function lookupsLeft(budget: BudgetState): number {
  return Math.min(budget.requestsRemaining, Math.floor(budget.rowsRemaining / ROWS_PER_LOOKUP));
}

export function lookupsPerDay(budget: BudgetState): number {
  return Math.min(budget.requestsLimit, Math.floor(budget.rowsLimit / ROWS_PER_LOOKUP));
}

/**
 * Decides whether a Bargo request may be made right now.
 *
 * `chart` is a lookup for the ticker the user is looking at; `alert` is a
 * background check of one watchlist ticker. Both draw on the same daily budget.
 */
export function allowRequest(budget: BudgetState, purpose: RequestPurpose): boolean {
  if (isExhausted(budget)) return false;
  if (purpose === 'chart') return true;
  // Alerts may spend the first half of the day's lookups; the rest is kept for
  // charts the user actually opens. A refused check is retried on the next tick.
  return lookupsLeft(budget) > Math.floor(lookupsPerDay(budget) * ALERT_SHARE);
}
