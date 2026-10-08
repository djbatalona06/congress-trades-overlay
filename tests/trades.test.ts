import { describe, expect, it, vi } from 'vitest';
import { formatDate, lookupsLeft, lookupsPerDay } from '@/lib/format';
import { lookupParty } from '@/lib/party';
import { toCongressTrades } from '@/lib/trades';
import { bargoTrade, budget } from './helpers';

vi.mock('@/assets/party-map.json', () => ({
  default: {
    generatedAt: '2026-10-08',
    house: {
      CA11: { last: 'pelosi', party: 'D' },
      VA05: { last: 'mcguire', party: 'R' },
    },
    senate: {
      RI: [
        { last: 'whitehouse', party: 'D' },
        { last: 'reed', party: 'D' },
      ],
      MD: [{ last: 'van hollen', party: 'D' }],
      VT: [{ last: 'sanders', party: 'I' }],
    },
  },
}));

describe('lookupParty', () => {
  it('finds a representative by district and surname', () => {
    expect(lookupParty('house', 'CA11', 'Nancy Pelosi')).toBe('D');
    expect(lookupParty('house', 'VA05', 'John J Mr McGuire III')).toBe('R');
  });

  it('finds a senator by state and surname', () => {
    expect(lookupParty('senate', 'RI', 'Sheldon Whitehouse')).toBe('D');
    expect(lookupParty('senate', 'MD', 'Chris Van Hollen')).toBe('D');
    expect(lookupParty('senate', 'VT', 'Bernard Sanders')).toBe('I');
  });

  it('gives no party when the seat is now held by someone else', () => {
    expect(lookupParty('house', 'CA11', 'Former Member')).toBeNull();
    expect(lookupParty('senate', 'RI', 'Someone Else')).toBeNull();
  });

  it('gives no party for unknown seats or missing fields', () => {
    expect(lookupParty('house', 'ZZ99', 'Nancy Pelosi')).toBeNull();
    expect(lookupParty(null, 'CA11', 'Nancy Pelosi')).toBeNull();
    expect(lookupParty('house', null, 'Nancy Pelosi')).toBeNull();
  });
});

describe('toCongressTrades', () => {
  const toCongressTrade = (raw: ReturnType<typeof bargoTrade>, ticker: string) =>
    toCongressTrades([raw], ticker)[0]!;

  it('keeps identical filing lines apart, with stable ids', () => {
    const ids = toCongressTrades([bargoTrade(), bargoTrade(), bargoTrade({ type: 'sale' }), bargoTrade()], 'NVDA').map(
      (trade) => trade.id,
    );
    expect(ids).toEqual([
      'nancy-pelosi|NVDA|purchase|2026-08-18|1001',
      'nancy-pelosi|NVDA|purchase|2026-08-18|1001#2',
      'nancy-pelosi|NVDA|sale|2026-08-18|1001',
      'nancy-pelosi|NVDA|purchase|2026-08-18|1001#3',
    ]);
  });

  it('maps a Bargo row', () => {
    expect(toCongressTrade(bargoTrade(), 'NVDA')).toEqual({
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
    });
  });

  it('gives different ids to different filing lines', () => {
    const a = toCongressTrade(bargoTrade(), 'NVDA');
    const b = toCongressTrade(bargoTrade({ type: 'sale' }), 'NVDA');
    const c = toCongressTrade(bargoTrade({ transaction_date: '2026-08-19' }), 'NVDA');
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });

  it('tolerates nulls and unexpected values', () => {
    const trade = toCongressTrade(
      bargoTrade({
        member: null,
        member_slug: null,
        chamber: 'cabinet',
        state: null,
        ticker: null,
        type: 'gift',
        amount_range: null,
        filing_portal: 'javascript:alert(1)',
      }),
      'NVDA',
    );
    expect(trade).toMatchObject({
      member: 'Unknown member',
      party: null,
      chamber: null,
      ticker: 'NVDA',
      type: null,
      amount: 'Amount not disclosed',
      sourceUrl: null,
    });
  });
});

describe('format', () => {
  it('formats disclosure dates without shifting the day', () => {
    expect(formatDate('2026-09-10')).toBe('Sep 10, 2026');
    expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
    expect(formatDate(null)).toBe('Unknown');
    expect(formatDate('not a date')).toBe('Unknown');
  });

  it('counts lookups by whichever budget runs out first', () => {
    expect(lookupsPerDay(budget())).toBe(20);
    expect(lookupsLeft(budget({ requestsRemaining: 3 }))).toBe(3);
    expect(lookupsLeft(budget({ rowsRemaining: 12 }))).toBe(2);
    expect(lookupsPerDay(budget({ requestsLimit: 100, rowsLimit: 1000 }))).toBe(100);
  });
});
