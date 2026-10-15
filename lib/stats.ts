// Numbers for the graph panel. Pure functions over trades the extension already
// holds: nothing here records anything about the person using it.

import type { CongressTrade } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export type SizeBand = 'small' | 'medium' | 'large' | 'xlarge' | 'unknown';
export const SIZE_BANDS: readonly SizeBand[] = ['small', 'medium', 'large', 'xlarge', 'unknown'];
export const SIZE_LABEL: Record<SizeBand, string> = {
  small: 'Up to $15K',
  medium: '$15K to $50K',
  large: '$50K to $250K',
  xlarge: 'Over $250K',
  unknown: 'Not disclosed',
};

export type PartyKey = 'D' | 'R' | 'I' | 'unknown';
export const PARTY_KEYS: readonly PartyKey[] = ['D', 'R', 'I', 'unknown'];

export interface WeekBucket {
  /** Monday of the week, "YYYY-MM-DD" (UTC). */
  weekStart: string;
  buys: number;
  sells: number;
}

export interface TradeStats {
  total: number;
  buys: number;
  sells: number;
  members: number;
  byParty: Record<PartyKey, number>;
  bySize: Record<SizeBand, number>;
  weekly: WeekBucket[];
}

/** The day a trade belongs to: when it was made, else when it was filed. */
function tradeDay(trade: CongressTrade): number | null {
  const value = trade.transactionDate ?? trade.filedDate;
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const time = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

/** Lower end of an amount range such as "$1,001 - $15,000", or null when no dollar figure is there. */
export function amountLow(amount: string): number | null {
  const match = amount.match(/\$\s*([\d,]+)/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function sizeBand(amount: string): SizeBand {
  const low = amountLow(amount);
  if (low === null) return 'unknown';
  if (low <= 15_000) return 'small';
  if (low <= 50_000) return 'medium';
  if (low <= 250_000) return 'large';
  return 'xlarge';
}

/** Monday (UTC) of the week that holds `time`. */
function mondayOf(time: number): number {
  const day = new Date(time).getUTCDay(); // 0 = Sunday
  const back = (day + 6) % 7;
  return Date.UTC(
    new Date(time).getUTCFullYear(),
    new Date(time).getUTCMonth(),
    new Date(time).getUTCDate() - back,
  );
}

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * Trades inside the last `days` days, and inside the equal stretch just before
 * it. Trades with no usable date fall in neither.
 */
export function splitPeriods(
  trades: readonly CongressTrade[],
  now: number,
  days: number,
): { current: CongressTrade[]; previous: CongressTrade[] } {
  const start = now - days * DAY_MS;
  const before = start - days * DAY_MS;
  const current: CongressTrade[] = [];
  const previous: CongressTrade[] = [];
  for (const trade of trades) {
    const day = tradeDay(trade);
    if (day === null) continue;
    // A trade dated today sits at midnight UTC, so it can be a little ahead of `now`'s clock reading.
    if (day >= start && day <= now + DAY_MS) current.push(trade);
    else if (day >= before && day < start) previous.push(trade);
  }
  return { current, previous };
}

export function computeStats(trades: readonly CongressTrade[]): TradeStats {
  const byParty: Record<PartyKey, number> = { D: 0, R: 0, I: 0, unknown: 0 };
  const bySize: Record<SizeBand, number> = { small: 0, medium: 0, large: 0, xlarge: 0, unknown: 0 };
  const members = new Set<string>();
  const weeks = new Map<number, WeekBucket>();
  let buys = 0;
  let sells = 0;

  for (const trade of trades) {
    if (trade.type === 'purchase') buys += 1;
    if (trade.type === 'sale') sells += 1;
    members.add(trade.memberSlug || trade.member);
    byParty[trade.party ?? 'unknown'] += 1;
    bySize[sizeBand(trade.amount)] += 1;

    const day = tradeDay(trade);
    if (day === null || (trade.type !== 'purchase' && trade.type !== 'sale')) continue;
    const monday = mondayOf(day);
    const bucket = weeks.get(monday) ?? { weekStart: isoDay(monday), buys: 0, sells: 0 };
    if (trade.type === 'purchase') bucket.buys += 1;
    else bucket.sells += 1;
    weeks.set(monday, bucket);
  }

  // One bucket per calendar week between the first and the last, so quiet weeks show as gaps.
  const keys = [...weeks.keys()].sort((a, b) => a - b);
  const weekly: WeekBucket[] = [];
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first !== undefined && last !== undefined) {
    for (let week = first; week <= last; week += 7 * DAY_MS) {
      weekly.push(weeks.get(week) ?? { weekStart: isoDay(week), buys: 0, sells: 0 });
    }
  }

  return { total: trades.length, buys, sells, members: members.size, byParty, bySize, weekly };
}

/** "+2", "-1" or "no change", for the change-versus-before chip. */
export function describeChange(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return 'no change';
  return diff > 0 ? `+${diff}` : `${diff}`;
}
