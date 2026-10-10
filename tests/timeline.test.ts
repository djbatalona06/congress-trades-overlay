import { describe, expect, it } from 'vitest';
import { mergeTimeline } from '@/lib/timeline';
import type { ExecOrder, RelatedBill } from '@/lib/types';
import { congressTrade } from './helpers';

function bill(overrides: Partial<RelatedBill> = {}): RelatedBill {
  return {
    id: '119-hr-1',
    title: 'Defense Authorization Act',
    status: 'became_law',
    date: '2026-08-27',
    policy_area: 'Armed Forces and National Security',
    public_law: '119-5',
    url: 'https://www.congress.gov/bill/119th-congress/house-bill/1',
    ...overrides,
  };
}

function order(overrides: Partial<ExecOrder> = {}): ExecOrder {
  return {
    document_number: '2026-0001',
    number: 14999,
    title: 'Strengthening Defense Shipbuilding',
    signing_date: '2026-08-20',
    publication_date: '2026-08-25',
    url: 'https://www.federalregister.gov/d/2026-0001',
    ...overrides,
  };
}

const dates = (events: ReturnType<typeof mergeTimeline>) => events.map((event) => `${event.kind}:${event.date}`);

describe('mergeTimeline', () => {
  it('interleaves trades, bills and orders newest first', () => {
    const events = mergeTimeline(
      [congressTrade({ transactionDate: '2026-08-18' })],
      [bill({ date: '2026-08-27' })],
      [order({ signing_date: '2026-08-20' })],
    );
    expect(dates(events)).toEqual(['bill:2026-08-27', 'order:2026-08-20', 'trade:2026-08-18']);
  });

  it('places a trade on the day it was made, not the day it was filed', () => {
    const [event] = mergeTimeline([congressTrade({ transactionDate: '2026-08-18', filedDate: '2026-09-10' })], [], []);
    expect(event?.date).toBe('2026-08-18');
  });

  it('falls back to the filing day, and to the publication day for an order, when the first date is missing', () => {
    const events = mergeTimeline(
      [congressTrade({ transactionDate: null, filedDate: '2026-09-10' })],
      [],
      [order({ signing_date: null, publication_date: '2026-08-25' })],
    );
    expect(dates(events)).toEqual(['trade:2026-09-10', 'order:2026-08-25']);
  });

  it('lists a trade before a bill before an order on the same day, then by id', () => {
    const events = mergeTimeline(
      [congressTrade({ id: 't', transactionDate: '2026-08-20' })],
      [bill({ id: 'b2', date: '2026-08-20' }), bill({ id: 'b1', date: '2026-08-20' })],
      [order({ signing_date: '2026-08-20' })],
    );
    expect(events.map((event) => event.id)).toEqual(['t', 'b1', 'b2', '2026-0001']);
  });

  it('drops events with no usable date instead of guessing one', () => {
    const events = mergeTimeline(
      [congressTrade({ transactionDate: null, filedDate: null }), congressTrade({ id: 'bad', transactionDate: 'soon', filedDate: null })],
      [bill({ date: '' })],
      [order({ signing_date: null, publication_date: 'n/a' })],
    );
    expect(events).toEqual([]);
  });

  it('reads the day from a timestamp', () => {
    const [event] = mergeTimeline([], [bill({ date: '2026-08-27T13:45:00Z' })], []);
    expect(event?.date).toBe('2026-08-27');
  });

  it('handles empty input and leaves its inputs alone', () => {
    expect(mergeTimeline([], [], [])).toEqual([]);
    const trades = [congressTrade({ id: 'old', transactionDate: '2026-01-01' }), congressTrade({ id: 'new', transactionDate: '2026-02-01' })];
    mergeTimeline(trades, [], []);
    expect(trades.map((trade) => trade.id)).toEqual(['old', 'new']);
  });
});
