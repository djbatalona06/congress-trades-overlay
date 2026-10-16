import { describe, expect, it } from 'vitest';
import { computeSignals } from '@/lib/signals';
import type { IeSpend, LobbyFiling, RelatedBill, TaxFlag, TickerContext } from '@/lib/types';
import { NOON, congressTrade } from './helpers';

const bill = (overrides: Partial<RelatedBill> = {}): RelatedBill => ({
  id: '119-hr-1',
  title: 'Energy Act',
  status: 'became_law',
  date: '2026-09-20',
  policy_area: 'Energy',
  public_law: '119-5',
  url: 'https://www.congress.gov/bill/119th-congress/house-bill/1',
  ...overrides,
});
const flag: TaxFlag = { bill_id: '119-hr-1', section_cite: '26 U.S.C. 45X', url: bill().url };
const spend = (overrides: Partial<IeSpend> = {}): IeSpend => ({
  committee_id: 'C001',
  committee_name: 'Some Committee',
  member_slug: 'nancy-pelosi',
  candidate_name: 'Nancy Pelosi',
  support_or_oppose: 'support',
  amount: 5000,
  date: '2026-09-01',
  url: 'https://docs.fec.gov/x',
  ...overrides,
});
const lobby: LobbyFiling = {
  registrant: 'Big Firm LLP',
  client: 'Acme',
  issue_codes: ['DEF'],
  amount: 1000,
  period: '2026 Q3',
  date: '2026-10-08',
  url: 'https://lda.senate.gov/x',
};
const ctx = (extra: Partial<TickerContext>): TickerContext => ({ related_bills: [], exec_orders: [], ...extra });
const chipIds = (context: TickerContext) =>
  computeSignals([congressTrade()], context, NOON).chips.map((chip) => chip.id);

describe('Influence chips', () => {
  it('light a tax-break chip only for reviewed flags on a bill that became law', () => {
    expect(chipIds(ctx({ related_bills: [bill()], tax_flags: [flag] }))).toContain('tax-break');
    expect(chipIds(ctx({ related_bills: [bill({ status: 'passed_chamber' })], tax_flags: [flag] }))).not.toContain('tax-break');
    expect(chipIds(ctx({ related_bills: [bill()], tax_flags: [] }))).not.toContain('tax-break');
  });

  it('light an outside-money chip only for members who traded this stock', () => {
    expect(chipIds(ctx({ ie_spend: [spend()] }))).toContain('outside-money');
    expect(chipIds(ctx({ ie_spend: [spend({ member_slug: 'someone-else' })] }))).not.toContain('outside-money');
  });

  it('light a lobbying chip when filings exist, and not otherwise', () => {
    expect(chipIds(ctx({ lobbying: [lobby] }))).toContain('lobbying');
    expect(chipIds(ctx({ lobbying: [] }))).not.toContain('lobbying');
  });

  it('treat every group the same and never move the score', () => {
    const a = computeSignals([congressTrade()], ctx({ ie_spend: [spend({ committee_name: 'A' })] }), NOON);
    const b = computeSignals([congressTrade()], ctx({ ie_spend: [spend({ committee_name: 'B', amount: 1 })] }), NOON);
    expect(a.chips.find((c) => c.id === 'outside-money')?.detail).toBe(
      b.chips.find((c) => c.id === 'outside-money')?.detail,
    );
    const plain = computeSignals([congressTrade()], ctx({}), NOON);
    const full = computeSignals([congressTrade()], ctx({ related_bills: [bill()], tax_flags: [flag], ie_spend: [spend()], lobbying: [lobby] }), NOON);
    expect(full.score).toBe(plain.score);
    expect(full.level).toBe(plain.level);
    expect(full.chips.filter((c) => ['tax-break', 'outside-money', 'lobbying'].includes(c.id)).every((c) => c.points === 0)).toBe(true);
  });
});
