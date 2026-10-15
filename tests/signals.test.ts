import { describe, expect, it } from 'vitest';
import {
  BIG_TRADE_OVER,
  computeSignals,
  levelFor,
  topOfRange,
  topReason,
  type SignalId,
} from '@/lib/signals';
import type { CongressTrade, TickerContext } from '@/lib/types';
import { NOON, congressTrade } from './helpers';

// NOON is 2026-10-07 12:00 UTC. Days are counted back from it.
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOON - n * DAY_MS).toISOString().slice(0, 10);

let counter = 0;
function trade(overrides: Partial<CongressTrade> = {}): CongressTrade {
  counter += 1;
  return congressTrade({
    id: `t${counter}`,
    memberSlug: `member-${counter}`,
    member: `Member ${counter}`,
    transactionDate: daysAgo(20),
    filedDate: daysAgo(10),
    amount: '$1,001 - $15,000',
    party: 'D',
    ...overrides,
  });
}

const ids = (trades: CongressTrade[], context?: TickerContext) =>
  computeSignals(trades, context, NOON).chips.map((chip) => chip.id as SignalId);

describe('topOfRange', () => {
  it('reads the top of a filed range', () => {
    expect(topOfRange('$1,001 - $15,000')).toBe(15000);
    expect(topOfRange('$250,001 - $500,000')).toBe(500000);
    expect(topOfRange('$1,000,001 - $5,000,000')).toBe(5000000);
  });

  it('reads open-ended ranges', () => {
    expect(topOfRange('Over $50,000,000')).toBe(50000000);
  });

  it('returns null when there is no amount', () => {
    expect(topOfRange('Amount not disclosed')).toBeNull();
    expect(topOfRange('')).toBeNull();
  });
});

describe('levelFor', () => {
  it('turns a score into a level at the documented thresholds', () => {
    expect(levelFor(0)).toBe('quiet');
    expect(levelFor(1)).toBe('quiet');
    expect(levelFor(2)).toBe('watch');
    expect(levelFor(4)).toBe('watch');
    expect(levelFor(5)).toBe('hot');
  });
});

describe('computeSignals: cluster', () => {
  it('lights a cluster buy when 3 different members buy within 30 days', () => {
    const trades = [20, 10, 0].map((gap) => trade({ transactionDate: daysAgo(30 - gap), filedDate: daysAgo(5) }));
    expect(ids(trades)).toContain('cluster-buy');
  });

  it('needs three different members, not three filings', () => {
    const sameMember = { memberSlug: 'one', member: 'One' };
    const trades = [trade(sameMember), trade(sameMember), trade(sameMember)];
    expect(ids(trades)).not.toContain('cluster-buy');
  });

  it('does not light for only two members', () => {
    expect(ids([trade(), trade()])).not.toContain('cluster-buy');
  });

  it('counts a 30 day gap but not a 31 day gap', () => {
    const inside = [
      trade({ transactionDate: daysAgo(50) }),
      trade({ transactionDate: daysAgo(35) }),
      trade({ transactionDate: daysAgo(20) }),
    ];
    expect(ids(inside)).toContain('cluster-buy');

    const outside = [
      trade({ transactionDate: daysAgo(51) }),
      trade({ transactionDate: daysAgo(35) }),
      trade({ transactionDate: daysAgo(20) }),
    ];
    expect(ids(outside)).not.toContain('cluster-buy');
  });

  it('keeps buys and sells apart', () => {
    const trades = [trade(), trade(), trade({ type: 'sale' })];
    expect(ids(trades)).not.toContain('cluster-buy');
    expect(ids(trades)).not.toContain('cluster-sell');
  });

  it('lights a cluster sell', () => {
    const trades = [trade({ type: 'sale' }), trade({ type: 'sale' }), trade({ type: 'sale' })];
    expect(ids(trades)).toContain('cluster-sell');
  });

  it('ignores trades disclosed more than 90 days ago', () => {
    const old = { transactionDate: daysAgo(150), filedDate: daysAgo(100) };
    expect(ids([trade(old), trade(old), trade(old)])).not.toContain('cluster-buy');
  });
});

describe('computeSignals: both parties', () => {
  it('lights when a Democrat and a Republican both buy', () => {
    expect(ids([trade({ party: 'D' }), trade({ party: 'R' })])).toContain('both-parties');
  });

  it('does not light for one party, or for unknown parties', () => {
    expect(ids([trade({ party: 'D' }), trade({ party: 'D' })])).not.toContain('both-parties');
    expect(ids([trade({ party: null }), trade({ party: 'R' })])).not.toContain('both-parties');
  });

  it('does not light when only one side sold', () => {
    expect(ids([trade({ party: 'D' }), trade({ party: 'R', type: 'sale' })])).not.toContain('both-parties');
  });
});

describe('computeSignals: size, freshness and lateness', () => {
  it('flags a big trade by the top of its range', () => {
    expect(ids([trade({ amount: '$250,001 - $500,000' })])).toContain('big-trade');
    expect(ids([trade({ amount: '$100,001 - $250,000' })])).not.toContain('big-trade');
    expect(BIG_TRADE_OVER).toBe(250_000);
  });

  it('ignores an unreadable amount', () => {
    expect(ids([trade({ amount: 'Amount not disclosed' })])).not.toContain('big-trade');
  });

  it('flags a filing made public in the last 7 days only', () => {
    expect(ids([trade({ filedDate: daysAgo(7) })])).toContain('fresh-filing');
    expect(ids([trade({ filedDate: daysAgo(8) })])).not.toContain('fresh-filing');
  });

  it('flags a filing more than 45 days after the trade, and gives it no points', () => {
    const late = computeSignals(
      [trade({ transactionDate: daysAgo(80), filedDate: daysAgo(34) })],
      undefined,
      NOON,
    );
    expect(late.chips.map((chip) => chip.id)).toContain('filed-late');
    expect(late.chips.find((chip) => chip.id === 'filed-late')?.points).toBe(0);
    expect(late.score).toBe(0);

    const onTime = [trade({ transactionDate: daysAgo(79), filedDate: daysAgo(34) })];
    expect(ids(onTime)).not.toContain('filed-late');
  });
});

describe('computeSignals: policy nearby', () => {
  const near: TickerContext = {
    related_bills: [
      {
        id: '119-hr-1',
        title: 'A bill',
        status: 'passed_chamber',
        date: daysAgo(15),
        policy_area: 'Technology',
        public_law: null,
        url: 'https://www.congress.gov/bill/119th-congress/house-bill/1',
      },
    ],
    exec_orders: [],
  };

  it('needs the context to light', () => {
    expect(ids([trade()])).not.toContain('policy-nearby');
    expect(ids([trade()], near)).toContain('policy-nearby');
  });

  it('stays dark when the bill is far from every trade', () => {
    const far: TickerContext = { ...near, related_bills: [{ ...near.related_bills[0]!, date: daysAgo(85) }] };
    expect(ids([trade({ transactionDate: daysAgo(20) })], far)).not.toContain('policy-nearby');
  });

  it('counts an executive order by its signing day', () => {
    const order: TickerContext = {
      related_bills: [],
      exec_orders: [
        {
          document_number: '2026-1',
          number: 14000,
          title: 'An order',
          signing_date: daysAgo(18),
          publication_date: daysAgo(16),
          url: 'https://www.federalregister.gov/d/2026-1',
        },
      ],
    };
    expect(ids([trade()], order)).toContain('policy-nearby');
  });
});

describe('computeSignals: levels and safety', () => {
  it('is quiet with no trades', () => {
    expect(computeSignals([], undefined, NOON)).toEqual({ level: 'quiet', score: 0, chips: [] });
  });

  it('adds up to Hot for a cluster that both parties joined', () => {
    const trades = [
      trade({ party: 'D' }),
      trade({ party: 'R' }),
      trade({ party: 'D', amount: '$500,001 - $1,000,000' }),
    ];
    const summary = computeSignals(trades, undefined, NOON);
    // cluster 3 + both parties 2 + big trade 1 (filings are 10 days old, so none are fresh)
    expect(summary.score).toBe(6);
    expect(summary.level).toBe('hot');
  });

  it('skips trades with no usable dates instead of guessing', () => {
    const undated = { transactionDate: null, filedDate: null };
    expect(computeSignals([trade(undated), trade(undated), trade(undated)], undefined, NOON).chips).toEqual([]);
    const junk = { transactionDate: 'soon', filedDate: 'later' };
    expect(computeSignals([trade(junk)], undefined, NOON).chips).toEqual([]);
  });

  it('skips trades filed in the future', () => {
    expect(ids([trade({ filedDate: daysAgo(-3) })])).toEqual([]);
  });

  it('points at the trades behind each chip', () => {
    const a = trade();
    const b = trade();
    const c = trade();
    const cluster = computeSignals([a, b, c], undefined, NOON).chips.find((chip) => chip.id === 'cluster-buy');
    expect(cluster?.tradeIds.sort()).toEqual([a.id, b.id, c.id].sort());
  });
});

describe('topReason', () => {
  it('gives the strongest scoring reason, never a points-free one', () => {
    const trades = [trade(), trade(), trade()];
    expect(topReason(computeSignals(trades, undefined, NOON))).toMatch(/3 different members bought/);
    const lateOnly = computeSignals(
      [trade({ transactionDate: daysAgo(80), filedDate: daysAgo(34) })],
      undefined,
      NOON,
    );
    expect(topReason(lateOnly)).toBeNull();
  });
});
