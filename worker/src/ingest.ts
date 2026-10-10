import { parseBillListItem, parsePolicyArea } from './bills';
import { parseOrder } from './orders';
import type { Store } from './types';

const CONGRESS_API = 'https://api.congress.gov/v3';
const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1/documents.json';

const PAGE_LIMIT = 250;
/** Newest-first pages per run; a normal hour of updates fits in one. */
const MAX_PAGES = 4;
/** Detail lookups per run, to stay well inside the Worker's subrequest cap. */
const DETAIL_PER_RUN = 40;
/** First run only: how far back to look for updated bills. */
const FIRST_RUN_DAYS = 14;
/** Re-read a little before the last run so a late-arriving update is not missed. */
const OVERLAP_MS = 15 * 60 * 1000;
const ORDERS_LOOKBACK_DAYS = 90;

const BILLS_SINCE_KEY = 'bills_since';
const DAY_MS = 24 * 60 * 60 * 1000;

type Fetch = typeof fetch;

/** Congress.gov wants "YYYY-MM-DDTHH:MM:SSZ", with no milliseconds. */
const isoSeconds = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

async function getJson(fetchFn: Fetch, url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetchFn(url, { headers: { Accept: 'application/json', ...headers } });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

/**
 * Pulls bills updated since the last run, keeps those that passed a chamber,
 * reached the President or became law, and fills in each one's policy area.
 */
export async function syncBills(
  store: Store,
  apiKey: string,
  now = Date.now(),
  fetchFn: Fetch = fetch,
): Promise<{ saved: number; looked_up: number }> {
  const headers = { 'X-Api-Key': apiKey };
  const stored = await store.getState(BILLS_SINCE_KEY);
  const since = stored ?? isoSeconds(now - FIRST_RUN_DAYS * DAY_MS);

  let saved = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      format: 'json',
      limit: String(PAGE_LIMIT),
      offset: String(page * PAGE_LIMIT),
      sort: 'updateDate+desc',
      fromDateTime: since,
    });
    // URLSearchParams would turn the "+" in the sort value into %2B.
    const url = `${CONGRESS_API}/bill?${params.toString().replace('%2B', '+')}`;
    const body = (await getJson(fetchFn, url, headers)) as { bills?: unknown };
    const items = Array.isArray(body.bills) ? body.bills : [];
    const rows = items.flatMap((item) => parseBillListItem(item) ?? []);
    await store.upsertBills(rows);
    saved += rows.length;
    if (items.length < PAGE_LIMIT) break;
  }
  await store.setState(BILLS_SINCE_KEY, isoSeconds(now - OVERLAP_MS));

  let lookedUp = 0;
  for (const bill of await store.billsMissingPolicyArea(DETAIL_PER_RUN)) {
    try {
      const detail = await getJson(
        fetchFn,
        `${CONGRESS_API}/bill/${bill.congress}/${bill.type.toLowerCase()}/${bill.number}?format=json`,
        headers,
      );
      await store.setPolicyArea(bill.id, parsePolicyArea(detail));
      lookedUp++;
    } catch (error) {
      // Left as NULL, so the next run tries again.
      console.warn('[bills] detail lookup failed', bill.id, String(error));
    }
  }
  return { saved, looked_up: lookedUp };
}

/** Pulls recent executive orders from the Federal Register (no key needed). */
export async function syncOrders(
  store: Store,
  now = Date.now(),
  fetchFn: Fetch = fetch,
): Promise<{ saved: number }> {
  const params = new URLSearchParams({
    per_page: '100',
    order: 'newest',
    'conditions[presidential_document_type][]': 'executive_order',
    'conditions[publication_date][gte]': new Date(now - ORDERS_LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10),
  });
  for (const field of ['document_number', 'title', 'executive_order_number', 'signing_date', 'publication_date', 'html_url', 'abstract']) {
    params.append('fields[]', field);
  }
  const body = (await getJson(fetchFn, `${FEDERAL_REGISTER_API}?${params}`)) as { results?: unknown };
  const results = Array.isArray(body.results) ? body.results : [];
  const rows = results.flatMap((doc) => parseOrder(doc) ?? []);
  await store.upsertOrders(rows);
  return { saved: rows.length };
}
