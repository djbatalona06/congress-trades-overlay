import { describe, expect, it } from 'vitest';
import { amountLow, computeStats, describeChange, sizeBand, splitPeriods } from '@/lib/stats';
import { congressTrade } from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-07T12:00:00Z');
const trade = (over: Parameters<typeof congressTrade>[0]) => congressTrade(over);

describe('amountLow and sizeBand', () => {
  it('reads the lower end of a range', () => {
    expect(amountLow('$1,001 - $15,000')).toBe(1001);
    expect(amountLow('Over $50,000,000')).toBe(50_000_000);
    expect(amountLow('Amount not disclosed')).toBeNull();
  });

  it('sorts amounts into bands, unknown when there is no figure', () => {
    expect(sizeBand('$1,001 - $15,000')).toBe('small');
    expect(sizeBand('$15,001 - $50,000')).toBe('medium');
    expect(sizeBand('$100,001 - $250,000')).toBe('large');
    expect(sizeBand('$250,001 - $500,000')).toBe('xlarge');
    expect(sizeBand('Amount not disclosed')).toBe('unknown');
  });
});

describe('splitPeriods', () => {
  it('separates the last N days from the N days before, and drops undated trades', () => {
    const recent = trade({ id: 'a', transactionDate: '2026-10-01' });
    const older = trade({ id: 'b', transactionDate: '2026-09-20' });
    const tooOld = trade({ id: 'c', transactionDate: '2026-06-01' });
    const undated = trade({ id: 'd', transactionDate: null, filedDate: null });
    const { current, previous } = splitPeriods([recent, older, tooOld, undated], NOW, 14);
    expect(current.map((t) => t.id)).toEqual(['a']);
    expect(previous.map((t) => t.id)).toEqual(['b']);
  });

  it('falls back to the filing date when there is no trade date', () => {
    const t = trade({ id: 'e', transactionDate: null, filedDate: '2026-10-05' });
    expect(splitPeriods([t], NOW, 7).current).toHaveLength(1);
  });

  it('counts a trade dated today', () => {
    expect(splitPeriods([trade({ transactionDate: '2026-10-07' })], NOW, 7).current).toHaveLength(1);
    expect(NOW - 7 * DAY).toBeLessThan(NOW);
  });
});

describe('computeStats', () => {
  it('counts sides, members, parties and sizes', () => {
    const stats = computeStats([
      trade({ id: '1', type: 'purchase', party: 'D', memberSlug: 'a', amount: '$1,001 - $15,000' }),
      trade({ id: '2', type: 'sale', party: 'R', memberSlug: 'b', amount: '$50,001 - $100,000' }),
      trade({ id: '3', type: 'purchase', party: null, memberSlug: 'a', amount: 'Amount not disclosed' }),
      trade({ id: '4', type: 'exchange', party: 'I', memberSlug: 'c' }),
    ]);
    expect(stats.total).toBe(4);
    expect(stats.buys).toBe(2);
    expect(stats.sells).toBe(1);
    expect(stats.members).toBe(3);
    expect(stats.byParty).toEqual({ D: 1, R: 1, I: 1, unknown: 1 });
    expect(stats.bySize.small).toBe(2); // the default helper amount is small too
    expect(stats.bySize.large).toBe(1);
    expect(stats.bySize.unknown).toBe(1);
  });

  it('buckets buys and sells by week and fills quiet weeks with zeros', () => {
    const stats = computeStats([
      trade({ id: '1', type: 'purchase', transactionDate: '2026-09-15' }), // Tuesday, week of Sep 14
      trade({ id: '2', type: 'sale', transactionDate: '2026-09-16' }),
      trade({ id: '3', type: 'purchase', transactionDate: '2026-09-30' }), // week of Sep 28
    ]);
    expect(stats.weekly.map((w) => w.weekStart)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
    expect(stats.weekly[0]).toMatchObject({ buys: 1, sells: 1 });
    expect(stats.weekly[1]).toMatchObject({ buys: 0, sells: 0 });
    expect(stats.weekly[2]).toMatchObject({ buys: 1, sells: 0 });
  });

  it('returns empty buckets for no trades', () => {
    expect(computeStats([])).toMatchObject({ total: 0, buys: 0, sells: 0, members: 0, weekly: [] });
  });
});

describe('describeChange', () => {
  it('writes the change in words and signs', () => {
    expect(describeChange(3, 1)).toBe('+2');
    expect(describeChange(1, 3)).toBe('-2');
    expect(describeChange(2, 2)).toBe('no change');
  });
});
