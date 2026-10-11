import { describe, expect, it } from 'vitest';
import { classifyAction, parseBillListItem, parsePolicyArea } from '../worker/src/bills';
import { parseOrder } from '../worker/src/orders';

describe('classifyAction', () => {
  it.each([
    ['Became Public Law No: 119-5.', 'became_law', '119-5'],
    ['Became Private Law No: 119-2.', 'became_law', '119-2'],
    ['Vetoed by President.', 'vetoed', null],
    ['Presented to President.', 'to_president', null],
    ['Signed by President.', 'to_president', null],
    ['Passed Senate with an amendment by Yea-Nay Vote. 70 - 28.', 'passed_chamber', null],
    ['Passed/agreed to in House: On passage Passed by the Yeas and Nays: 310 - 118.', 'passed_chamber', null],
    ['Resolution agreed to in Senate without amendment and with a preamble by Unanimous Consent.', 'passed_chamber', null],
  ])('reads "%s"', (text, status, publicLaw) => {
    expect(classifyAction(text)).toEqual({ status, publicLaw });
  });

  it.each(['Introduced in House', 'Referred to the Committee on Armed Services.', 'Held at the desk.', ''])(
    'skips "%s"',
    (text) => {
      expect(classifyAction(text)).toBeNull();
    },
  );
});

describe('parseBillListItem', () => {
  const item = {
    congress: 119,
    type: 'HR',
    number: '1234',
    title: ' National Defense Act ',
    updateDate: '2026-10-06',
    latestAction: { actionDate: '2026-10-05', text: 'Became Public Law No: 119-5.' },
    url: 'https://api.congress.gov/v3/bill/119/hr/1234?format=json',
  };

  it('builds a row with a stable id and a public Congress.gov link', () => {
    expect(parseBillListItem(item)).toEqual({
      id: '119-hr-1234',
      congress: 119,
      type: 'HR',
      number: '1234',
      title: 'National Defense Act',
      status: 'became_law',
      actionDate: '2026-10-05',
      actionText: 'Became Public Law No: 119-5.',
      publicLaw: '119-5',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/1234',
    });
  });

  it('spells ordinals the way Congress.gov does', () => {
    const url = (congress: number) => parseBillListItem({ ...item, congress })?.url;
    expect(url(121)).toContain('/121st-congress/');
    expect(url(122)).toContain('/122nd-congress/');
    expect(url(123)).toContain('/123rd-congress/');
    expect(url(111)).toContain('/111th-congress/');
  });

  it('accepts a numeric bill number and a senate resolution', () => {
    expect(parseBillListItem({ ...item, type: 'SRES', number: 9 })).toMatchObject({
      id: '119-sres-9',
      url: 'https://www.congress.gov/bill/119th-congress/senate-resolution/9',
    });
  });

  it('drops bills that were only introduced and anything malformed', () => {
    expect(parseBillListItem({ ...item, latestAction: { actionDate: '2026-10-05', text: 'Introduced in House' } })).toBeNull();
    expect(parseBillListItem({ ...item, latestAction: { actionDate: 'yesterday', text: 'Became Public Law No: 119-5.' } })).toBeNull();
    expect(parseBillListItem({ ...item, latestAction: undefined })).toBeNull();
    expect(parseBillListItem({ ...item, congress: '119' })).toBeNull();
    expect(parseBillListItem(null)).toBeNull();
    expect(parseBillListItem('bill')).toBeNull();
  });
});

describe('parsePolicyArea', () => {
  it('reads the policy area name from a bill detail response', () => {
    expect(parsePolicyArea({ bill: { policyArea: { name: ' Energy ' } } })).toBe('Energy');
  });

  it('returns an empty string when none is assigned', () => {
    expect(parsePolicyArea({ bill: {} })).toBe('');
    expect(parsePolicyArea({ bill: { policyArea: {} } })).toBe('');
    expect(parsePolicyArea(null)).toBe('');
  });
});

describe('parseOrder', () => {
  const doc = {
    document_number: '2026-12345',
    title: ' Strengthening Defense Shipbuilding ',
    executive_order_number: '14999',
    signing_date: '2026-10-03',
    publication_date: '2026-10-06',
    html_url: 'https://www.federalregister.gov/documents/2026/10/06/2026-12345/x',
    abstract: ' Rebuilding the industrial base. ',
  };

  it('maps a Federal Register document', () => {
    expect(parseOrder(doc)).toEqual({
      document_number: '2026-12345',
      number: 14999,
      title: 'Strengthening Defense Shipbuilding',
      signing_date: '2026-10-03',
      publication_date: '2026-10-06',
      url: 'https://www.federalregister.gov/documents/2026/10/06/2026-12345/x',
      abstract: 'Rebuilding the industrial base.',
    });
  });

  it('keeps an order whose number or signing date is missing', () => {
    expect(parseOrder({ ...doc, executive_order_number: null, signing_date: null, abstract: null })).toMatchObject({
      number: null,
      signing_date: null,
      abstract: '',
    });
  });

  it('rejects documents it cannot place or link to', () => {
    expect(parseOrder({ ...doc, publication_date: 'soon' })).toBeNull();
    expect(parseOrder({ ...doc, html_url: 'javascript:alert(1)' })).toBeNull();
    expect(parseOrder({ ...doc, title: 5 })).toBeNull();
    expect(parseOrder(null)).toBeNull();
  });
});
