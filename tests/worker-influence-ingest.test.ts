import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseIeRow, parseNamedId, sameName } from '../worker/src/fec';
import { fetchOfficialIssueCodes, slugify, syncLobbying, syncMemberLinks, syncOutsideMoney, toMemberLinks } from '../worker/src/ingest';
import { parseFiling, parseIssueCodes } from '../worker/src/lda';
import { ALL_ISSUE_CODES } from '../worker/src/sectors';
import { reportIsClean, verifyInfluence } from '../worker/src/verify';
import { FakeStore } from './worker-helpers';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const asFetch = (fn: unknown) => fn as typeof fetch;

const ieRow = (overrides: Record<string, unknown> = {}) => ({
  sub_id: 4101,
  committee_id: 'C00000001',
  committee_name: 'Alpha Committee',
  candidate_name: 'PELOSI, NANCY',
  support_oppose_indicator: 'S',
  expenditure_amount: 5000.4,
  expenditure_date: '2026-09-01T00:00:00',
  pdf_url: 'https://docs.fec.gov/x.pdf',
  ...overrides,
});

const filing = (overrides: Record<string, unknown> = {}) => ({
  filing_uuid: 'uuid-1',
  registrant: { name: 'Big Firm LLP' },
  client: { name: 'Acme Defense' },
  income: '120000.00',
  filing_year: 2026,
  filing_period: 'third_quarter',
  filing_document_url: 'https://lda.senate.gov/filings/public/filing/uuid-1/print/',
  dt_posted: '2026-10-08T14:00:00-04:00',
  lobbying_activities: [{ general_issue_code: 'DEF' }, { general_issue_code: 'ZZZ' }],
  ...overrides,
});

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('FEC parsers', () => {
  it('read a good row and round the amount', () => {
    expect(parseIeRow(ieRow(), 'nancy-pelosi', NOW)).toMatchObject({
      id: '4101', committee_id: 'C00000001', member_slug: 'nancy-pelosi', support_or_oppose: 'support',
      amount: 5000, date: '2026-09-01', url: 'https://docs.fec.gov/x.pdf',
    });
  });

  it('drop rows that cannot be shown with a real link, side or amount', () => {
    for (const bad of [
      ieRow({ pdf_url: 'http://docs.fec.gov/x.pdf' }),
      ieRow({ pdf_url: null }),
      ieRow({ support_oppose_indicator: 'X' }),
      ieRow({ expenditure_amount: 0 }),
      ieRow({ expenditure_amount: 'lots' }),
      ieRow({ expenditure_date: 'soon' }),
      ieRow({ committee_id: '' }),
      'junk',
      null,
    ]) {
      expect(parseIeRow(bad, 'x', NOW)).toBeNull();
    }
  });

  it('read the committee name from the nested object too', () => {
    expect(parseIeRow(ieRow({ committee_name: undefined, committee: { name: 'Nested PAC' } }), 'x', NOW)?.committee_name).toBe('Nested PAC');
  });

  it('read a candidate or committee lookup, and compare names ignoring case and order', () => {
    expect(parseNamedId({ results: [{ committee_id: 'C1', name: 'Alpha Committee' }] }, 'committee_id')).toEqual({ id: 'C1', name: 'Alpha Committee' });
    expect(parseNamedId({ results: [] }, 'committee_id')).toBeNull();
    expect(sameName('PELOSI, NANCY', 'nancy pelosi')).toBe(true);
    expect(sameName('Alpha Committee', 'Beta Committee')).toBe(false);
  });
});

describe('LDA parsers', () => {
  it('read the official issue-code list', () => {
    expect(parseIssueCodes([{ value: 'DEF', name: 'Defense' }, { name: 'no value' }, { value: 'TAX' }])).toEqual(['DEF', 'TAX']);
    expect(parseIssueCodes({ results: [{ value: 'ENG' }] })).toEqual(['ENG']);
    expect(parseIssueCodes('nope')).toEqual([]);
  });

  it('keep only wanted issue codes, read the amount and label the period', () => {
    expect(parseFiling(filing(), new Set(['DEF']), NOW)).toMatchObject({
      id: 'uuid-1', registrant: 'Big Firm LLP', client: 'Acme Defense', issue_codes: ['DEF'],
      amount: 120000, period: '2026 Q3', posted_date: '2026-10-08',
    });
    expect(parseFiling(filing(), new Set(['TAX']), NOW)).toBeNull();
    expect(parseFiling(filing({ filing_document_url: 'http://x' }), new Set(['DEF']), NOW)).toBeNull();
    expect(parseFiling(filing({ income: null, expenses: null }), new Set(['DEF']), NOW)?.amount).toBeNull();
  });
});

describe('member links', () => {
  const legislators = [
    { id: { fec: ['H8CA05035', 'S0CA00001'] }, name: { official_full: 'Nancy Pelosi' }, terms: [{ type: 'rep', state: 'CA' }] },
    { id: { fec: [] }, name: { official_full: 'No Fec' }, terms: [{ type: 'sen', state: 'TX' }] },
    { id: { fec: ['S4TX00001'] }, name: { first: 'José', last: 'Núñez' }, terms: [{ type: 'rep', state: 'TX' }, { type: 'sen', state: 'TX' }] },
    'junk',
  ];

  it('slugs names the way Bargo does', () => {
    expect(slugify('Nancy Pelosi')).toBe('nancy-pelosi');
    expect(slugify('José Núñez')).toBe('jose-nunez');
  });

  it('links members to every FEC id, skipping members with none', () => {
    expect(toMemberLinks(legislators)).toEqual([
      { member_slug: 'nancy-pelosi', fec_candidate_id: 'H8CA05035', chamber: 'house', state: 'CA' },
      { member_slug: 'nancy-pelosi', fec_candidate_id: 'S0CA00001', chamber: 'house', state: 'CA' },
      { member_slug: 'jose-nunez', fec_candidate_id: 'S4TX00001', chamber: 'senate', state: 'TX' },
    ]);
  });

  it('saves them without resetting a synced time', async () => {
    const fetchFn = asFetch(vi.fn(async () => ok(legislators)));
    expect(await syncMemberLinks(store, fetchFn)).toEqual({ linked: 3 });
    await store.markMemberSynced({ member_slug: 'nancy-pelosi', fec_candidate_id: 'H8CA05035' }, 5);
    await syncMemberLinks(store, fetchFn);
    expect(store.links.find((l) => l.fec_candidate_id === 'H8CA05035')?.synced_at).toBe(5);
    expect(store.links).toHaveLength(3);
  });
});

describe('syncOutsideMoney', () => {
  beforeEach(async () => {
    await store.upsertMemberLinks([
      { member_slug: 'nancy-pelosi', fec_candidate_id: 'H1', chamber: 'house', state: 'CA' },
      { member_slug: 'mark-warner', fec_candidate_id: 'S1', chamber: 'senate', state: 'VA' },
    ]);
  });

  it('stores every spender the same way and sends the key in a header, never the URL', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) =>
      ok({
        results: String(input).includes('candidate_id=H1')
          ? [ieRow({ sub_id: 1, committee_id: 'C-A', committee_name: 'Group A' }), ieRow({ sub_id: 2, committee_id: 'C-B', committee_name: 'Group B', support_oppose_indicator: 'O' }), { junk: true }]
          : [],
      }),
    );
    expect(await syncOutsideMoney(store, 'secret-key', NOW, asFetch(fetchFn))).toEqual({ members: 2, saved: 2 });

    const calls = fetchFn.mock.calls as unknown as [string, RequestInit][];
    const [url, init] = calls.find(([u]) => u.includes('candidate_id=H1')) ?? ['', {}];
    expect(url).not.toContain('secret-key');
    expect(url).toContain('min_date=2025-10-10');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('secret-key');

    const [a, b] = [...store.ieRows.values()];
    expect(Object.keys(a ?? {}).sort()).toEqual(Object.keys(b ?? {}).sort());
    expect(a?.member_slug).toBe(b?.member_slug);
  });

  it('is idempotent, and rotates to the members synced longest ago', async () => {
    const fetchFn = asFetch(vi.fn(async () => ok({ results: [ieRow()] })));
    await syncOutsideMoney(store, 'k', NOW, fetchFn);
    await syncOutsideMoney(store, 'k', NOW + 1000, fetchFn);
    expect(store.ieRows.size).toBe(1);
    expect(store.links.every((l) => l.synced_at === NOW + 1000)).toBe(true);
  });

  it('keeps going, and still moves on, when one member fails', async () => {
    const fetchFn = asFetch(
      vi.fn(async (input: RequestInfo | URL) => (String(input).includes('candidate_id=H1') ? new Response('no', { status: 429 }) : ok({ results: [ieRow()] }))),
    );
    expect(await syncOutsideMoney(store, 'k', NOW, fetchFn)).toEqual({ members: 2, saved: 1 });
    expect(store.links.every((l) => l.synced_at === NOW)).toBe(true);
  });
});

describe('syncLobbying', () => {
  const route = (codes: string[], filings: unknown[]) =>
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/constants/') ? ok(codes.map((value) => ({ value, name: value }))) : ok({ results: filings }),
    );

  it('saves filings on confirmed codes and reports proposed codes the Senate does not list', async () => {
    const fetchFn = route(['DEF', 'TAX'], [filing()]);
    const result = await syncLobbying(store, 'token', NOW, asFetch(fetchFn));
    expect(result.saved).toBe(1);
    expect(result.unconfirmed_codes).toContain('ENG');
    expect(result.unconfirmed_codes).not.toContain('DEF');
    expect(store.lobbyRows.get('uuid-1')?.issue_codes).toEqual(['DEF']);

    const [url, init] = fetchFn.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).not.toContain('token');
    expect((init.headers as Record<string, string>).Authorization).toBe('Token token');
    expect(url).toContain('filing_dt_posted_after=2026-09-10T12%3A00%3A00Z');
  });

  it('does not move its since marker when the list call fails', async () => {
    const fetchFn = asFetch(vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/constants/') ? ok([{ value: 'DEF' }]) : new Response('x', { status: 500 }))));
    await expect(syncLobbying(store, undefined, NOW, fetchFn)).rejects.toThrow('answered 500');
    expect(store.state.size).toBe(0);
  });

  it('fetches the official list with no codes when the answer is not a list', async () => {
    expect(await fetchOfficialIssueCodes(undefined, asFetch(vi.fn(async () => ok({ detail: 'moved' }))))).toEqual([]);
  });
});

describe('verifyInfluence', () => {
  const fec = (map: Record<string, { committee_id?: string; candidate_id?: string; name: string } | 404>) =>
    asFetch(
      vi.fn(async (input: RequestInfo | URL) => {
        const id = String(input).split('/').filter(Boolean).at(-1) ?? '';
        const hit = map[id];
        return !hit || hit === 404 ? new Response('x', { status: 404 }) : ok({ results: [hit] });
      }),
    );

  const input = {
    members: [{ id: 'H1', name: 'nancy-pelosi' }, { id: 'H2', name: 'mark-warner' }, { id: 'H3', name: 'gone-member' }],
    committees: [{ id: 'C1', name: 'Alpha Committee' }, { id: 'C2', name: 'Beta Committee' }],
    officialIssueCodes: ['DEF'],
    tradeMembers: ['nancy-pelosi', 'unlinked-person'],
    linkedMembers: ['nancy-pelosi'],
  };

  it('reports matches, wrong names, missing ids, unofficial codes and unlinked traders', async () => {
    const report = await verifyInfluence(
      input,
      'k',
      fec({
        H1: { candidate_id: 'H1', name: 'PELOSI, NANCY' },
        H2: { candidate_id: 'H2', name: 'SOMEONE, ELSE' },
        C1: { committee_id: 'C1', name: 'ALPHA COMMITTEE' },
        C2: { committee_id: 'C2', name: 'Gamma Committee' },
      }),
    );
    expect(report.members).toMatchObject({ checked: 3, matched: 1, unreachable: ['H3'] });
    expect(report.members.mismatched).toEqual([{ id: 'H2', expected: 'mark-warner', found: 'SOMEONE, ELSE' }]);
    expect(report.committees.matched).toBe(1);
    expect(report.committees.mismatched).toEqual([{ id: 'C2', expected: 'Beta Committee', found: 'Gamma Committee' }]);
    expect(report.issueCodes.missing).toEqual(ALL_ISSUE_CODES.filter((c) => c !== 'DEF'));
    expect(report.tradersWithoutLink).toEqual(['unlinked-person']);
    expect(reportIsClean(report)).toBe(false);
  });

  it('is clean only when every id answers and matches and every code is official', async () => {
    const clean = await verifyInfluence(
      { members: [{ id: 'H1', name: 'nancy-pelosi' }], committees: [{ id: 'C1', name: 'Alpha Committee' }], officialIssueCodes: ALL_ISSUE_CODES, tradeMembers: [], linkedMembers: [] },
      'k',
      fec({ H1: { candidate_id: 'H1', name: 'PELOSI, NANCY' }, C1: { committee_id: 'C1', name: 'Alpha Committee' } }),
    );
    expect(reportIsClean(clean)).toBe(true);
  });

  it('treats an empty official code list as unconfirmed, not clean', async () => {
    const report = await verifyInfluence({ ...input, members: [], committees: [], officialIssueCodes: [] }, 'k', fec({}));
    expect(reportIsClean(report)).toBe(false);
  });

  it('never puts the key in a URL', async () => {
    const fetchFn = fec({ H1: { candidate_id: 'H1', name: 'PELOSI, NANCY' } });
    await verifyInfluence({ ...input, members: [input.members[0] as { id: string; name: string }], committees: [] }, 'secret-key', fetchFn);
    expect(String(vi.mocked(fetchFn).mock.calls[0]?.[0])).not.toContain('secret-key');
  });
});
