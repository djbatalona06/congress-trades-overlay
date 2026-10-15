import { parseBillListItem, parsePolicyArea } from './bills';
import { type IeSpendRow, parseIeRow } from './fec';
import { type LobbyingRow, parseFiling, parseIssueCodes } from './lda';
import { parseOrder } from './orders';
import { ALL_ISSUE_CODES } from './sectors';
import type { MemberLink, Store } from './types';

const CONGRESS_API = 'https://api.congress.gov/v3';
const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1/documents.json';

// The Senate's lobbying API address. If it moves (to lda.gov), this is the one line to change.
export const LDA_API = 'https://lda.senate.gov/api/v1';
export const FEC_API = 'https://api.open.fec.gov/v1';
export const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';

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

// ---- Influence layer: outside money and lobbying ----

/** Members whose outside spending is pulled per run, to stay inside the Worker's subrequest cap. */
const MEMBERS_PER_RUN = 25;
const IE_LOOKBACK_DAYS = 365;
const LOBBY_PAGES = 4;
const LOBBY_PAGE_SIZE = 25;
const LOBBY_FIRST_RUN_DAYS = 30;
const LOBBY_SINCE_KEY = 'lobby_since';

/** "Marjorie Taylor Greene" -> "marjorie-taylor-greene", the shape of Bargo's member slugs. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Turns the public legislators list into member -> FEC candidate links. Members with no FEC id are skipped. */
export function toMemberLinks(body: unknown): MemberLink[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((entry) => {
    const e = entry as {
      id?: { fec?: unknown };
      name?: { official_full?: unknown; first?: unknown; last?: unknown };
      terms?: { type?: unknown; state?: unknown }[];
    } | null;
    const full =
      typeof e?.name?.official_full === 'string'
        ? e.name.official_full
        : `${String(e?.name?.first ?? '')} ${String(e?.name?.last ?? '')}`;
    const term = e?.terms?.at(-1);
    const chamber = term?.type === 'sen' ? 'senate' : term?.type === 'rep' ? 'house' : null;
    const ids = Array.isArray(e?.id?.fec) ? e.id.fec.filter((id): id is string => typeof id === 'string' && id !== '') : [];
    if (!chamber || typeof term?.state !== 'string' || !full.trim() || ids.length === 0) return [];
    return ids.map((fec_candidate_id) => ({ member_slug: slugify(full), fec_candidate_id, chamber, state: term.state as string }));
  });
}

/** Saves the member -> FEC links (no key needed). Existing links keep their synced time. */
export async function syncMemberLinks(store: Store, fetchFn: Fetch = fetch): Promise<{ linked: number }> {
  const links = toMemberLinks(await getJson(fetchFn, LEGISLATORS_URL));
  await store.upsertMemberLinks(links);
  return { linked: links.length };
}

/** One member's independent expenditures: the parsed rows plus how many raw rows the FEC sent. */
export async function fetchIeSpend(
  link: Pick<MemberLink, 'member_slug' | 'fec_candidate_id'>,
  apiKey: string,
  now: number,
  fetchFn: Fetch = fetch,
): Promise<{ rows: IeSpendRow[]; received: number }> {
  const params = new URLSearchParams({
    candidate_id: link.fec_candidate_id,
    min_date: new Date(now - IE_LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10),
    sort: '-expenditure_date',
    per_page: '100',
  });
  // ponytail: first page only (newest 100 per member); follow `last_indexes` if a race ever needs more.
  const body = (await getJson(fetchFn, `${FEC_API}/schedules/schedule_e/?${params}`, { 'X-Api-Key': apiKey })) as { results?: unknown };
  const results = Array.isArray(body.results) ? body.results : [];
  return { rows: results.flatMap((row) => parseIeRow(row, link.member_slug, now) ?? []), received: results.length };
}

/**
 * Pulls the newest outside spending for the members synced longest ago. Every spender in a
 * member's race is stored the same way: no committee is picked or left out by name.
 */
export async function syncOutsideMoney(
  store: Store,
  apiKey: string,
  now = Date.now(),
  fetchFn: Fetch = fetch,
): Promise<{ members: number; saved: number }> {
  let saved = 0;
  const due = await store.membersDueForSync(MEMBERS_PER_RUN);
  for (const link of due) {
    try {
      const { rows } = await fetchIeSpend(link, apiKey, now, fetchFn);
      await store.upsertIeSpend(rows);
      saved += rows.length;
    } catch (error) {
      console.warn('[ie] lookup failed', link.fec_candidate_id, String(error));
    }
    // Marked even after a failure, so one stubborn member cannot block the rest; it is retried next lap.
    await store.markMemberSynced(link, now);
  }
  return { members: due.length, saved };
}

const ldaHeaders = (token?: string): Record<string, string> => (token ? { Authorization: `Token ${token}` } : {});

/** The Senate's own list of issue codes. */
export async function fetchOfficialIssueCodes(token?: string, fetchFn: Fetch = fetch): Promise<string[]> {
  return parseIssueCodes(await getJson(fetchFn, `${LDA_API}/constants/filing/lobbyingactivityissues/`, ldaHeaders(token)));
}

/** One page of filings posted after `since`, newest first, reduced to the wanted issue codes. */
export async function fetchRecentFilings(
  since: string,
  wanted: ReadonlySet<string>,
  page: number,
  now: number,
  token?: string,
  fetchFn: Fetch = fetch,
): Promise<{ rows: LobbyingRow[]; received: number }> {
  const params = new URLSearchParams({
    filing_dt_posted_after: since,
    ordering: '-dt_posted',
    page_size: String(LOBBY_PAGE_SIZE),
    page: String(page),
  });
  const body = (await getJson(fetchFn, `${LDA_API}/filings/?${params}`, ldaHeaders(token))) as { results?: unknown };
  const results = Array.isArray(body.results) ? body.results : [];
  return { rows: results.flatMap((item) => parseFiling(item, wanted, now) ?? []), received: results.length };
}

/**
 * Saves lobbying filings on issues tied to a sector. Only issue codes the Senate's own list
 * confirms are used; any other proposed code is reported back, never queried.
 */
export async function syncLobbying(
  store: Store,
  token?: string,
  now = Date.now(),
  fetchFn: Fetch = fetch,
): Promise<{ saved: number; unconfirmed_codes: string[] }> {
  const official = new Set(await fetchOfficialIssueCodes(token, fetchFn));
  const wanted = new Set(ALL_ISSUE_CODES.filter((code) => official.has(code)));
  const unconfirmed = ALL_ISSUE_CODES.filter((code) => !official.has(code));
  const since = (await store.getState(LOBBY_SINCE_KEY)) ?? isoSeconds(now - LOBBY_FIRST_RUN_DAYS * DAY_MS);

  let saved = 0;
  for (let page = 1; page <= LOBBY_PAGES; page++) {
    const { rows, received } = await fetchRecentFilings(since, wanted, page, now, token, fetchFn);
    await store.upsertLobbying(rows);
    saved += rows.length;
    if (received < LOBBY_PAGE_SIZE) break;
  }
  await store.setState(LOBBY_SINCE_KEY, isoSeconds(now - OVERLAP_MS));
  return { saved, unconfirmed_codes: unconfirmed };
}
