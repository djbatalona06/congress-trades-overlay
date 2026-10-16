import type { BargoTrade, IeSpend, LobbyFiling, RelatedBill, TaxFlag } from '../../lib/types';
import type { BillRow } from './bills';
import type { IeSpendRow } from './fec';
import type { LobbyingRow } from './lda';
import type { MemberLink, Store } from './types';

/** D1 does not allow more than 100 bound parameters in one statement. */
const MAX_AREAS = 20;

export function d1Store(db: D1Database): Store {
  return {
    async upsertBills(rows) {
      if (rows.length === 0) return;
      // policy_area is deliberately left out of the update: it is filled in once
      // from the detail endpoint and does not change with later actions.
      const statement = db.prepare(
        `INSERT INTO bills (id, congress, type, number, title, status, action_date, action_text, public_law, url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title, status = excluded.status, action_date = excluded.action_date,
           action_text = excluded.action_text, public_law = excluded.public_law, url = excluded.url`,
      );
      await db.batch(
        rows.map((r) =>
          statement.bind(r.id, r.congress, r.type, r.number, r.title, r.status, r.actionDate, r.actionText, r.publicLaw, r.url),
        ),
      );
    },

    async billsMissingPolicyArea(limit) {
      const { results } = await db
        .prepare(
          `SELECT id, congress, type, number FROM bills
           WHERE policy_area IS NULL ORDER BY action_date DESC LIMIT ?`,
        )
        .bind(limit)
        .all<{ id: string; congress: number; type: string; number: string }>();
      return results;
    },

    async setPolicyArea(id, policyArea) {
      await db.prepare('UPDATE bills SET policy_area = ? WHERE id = ?').bind(policyArea, id).run();
    },

    async relatedBills(policyAreas, sinceDay, limit) {
      const areas = policyAreas.slice(0, MAX_AREAS);
      if (areas.length === 0) return [];
      const marks = areas.map(() => '?').join(', ');
      const { results } = await db
        .prepare(
          `SELECT id, title, status, action_date, policy_area, public_law, url FROM bills
           WHERE policy_area IN (${marks}) AND action_date >= ?
           ORDER BY action_date DESC, id LIMIT ?`,
        )
        .bind(...areas, sinceDay, limit)
        .all<{
          id: string;
          title: string;
          status: RelatedBill['status'];
          action_date: string;
          policy_area: string;
          public_law: string | null;
          url: string;
        }>();
      return results.map(({ action_date, ...rest }) => ({ ...rest, date: action_date }));
    },

    async upsertOrders(rows) {
      if (rows.length === 0) return;
      const statement = db.prepare(
        `INSERT INTO executive_orders (document_number, eo_number, title, abstract, signing_date, publication_date, url)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(document_number) DO UPDATE SET
           eo_number = excluded.eo_number, title = excluded.title, abstract = excluded.abstract,
           signing_date = excluded.signing_date, publication_date = excluded.publication_date, url = excluded.url`,
      );
      await db.batch(
        rows.map((o) =>
          statement.bind(o.document_number, o.number, o.title, o.abstract, o.signing_date, o.publication_date, o.url),
        ),
      );
    },

    async recentOrders(sinceDay) {
      const { results } = await db
        .prepare(
          `SELECT document_number, eo_number, title, abstract, signing_date, publication_date, url
           FROM executive_orders
           WHERE COALESCE(signing_date, publication_date) >= ?
           ORDER BY COALESCE(signing_date, publication_date) DESC, document_number`,
        )
        .bind(sinceDay)
        .all<{
          document_number: string;
          eo_number: number | null;
          title: string;
          abstract: string;
          signing_date: string | null;
          publication_date: string;
          url: string;
        }>();
      return results.map(({ eo_number, ...rest }) => ({ ...rest, number: eo_number }));
    },

    async ieSpendForMembers(memberSlugs, sinceDay, limit) {
      const slugs = memberSlugs.slice(0, MAX_AREAS);
      if (slugs.length === 0) return [];
      const marks = slugs.map(() => '?').join(', ');
      const { results } = await db
        .prepare(
          `SELECT committee_id, committee_name, member_slug, candidate_name, support_or_oppose, amount, spend_date, url
           FROM ie_spend WHERE member_slug IN (${marks}) AND spend_date >= ?
           ORDER BY spend_date DESC, id LIMIT ?`,
        )
        .bind(...slugs, sinceDay, limit)
        .all<Omit<IeSpend, 'date'> & { spend_date: string }>();
      return results.map(({ spend_date, ...rest }) => ({ ...rest, date: spend_date }));
    },

    async reviewedTaxFlags(billIds) {
      const ids = billIds.slice(0, MAX_AREAS);
      if (ids.length === 0) return [];
      const marks = ids.map(() => '?').join(', ');
      const { results } = await db
        .prepare(
          `SELECT f.bill_id, f.section_cite, b.url FROM bill_tax_flags f JOIN bills b ON b.id = f.bill_id
           WHERE f.bill_id IN (${marks}) AND f.reviewer IS NOT NULL
           ORDER BY f.bill_id, f.section_cite`,
        )
        .bind(...ids)
        .all<TaxFlag>();
      return results;
    },

    async upsertIeSpend(rows: IeSpendRow[]) {
      if (rows.length === 0) return;
      const statement = db.prepare(
        `INSERT INTO ie_spend (id, committee_id, committee_name, member_slug, candidate_name, support_or_oppose, amount, spend_date, url, retrieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           committee_name = excluded.committee_name, candidate_name = excluded.candidate_name,
           support_or_oppose = excluded.support_or_oppose, amount = excluded.amount,
           spend_date = excluded.spend_date, url = excluded.url, retrieved_at = excluded.retrieved_at`,
      );
      await db.batch(
        rows.map((r) =>
          statement.bind(r.id, r.committee_id, r.committee_name, r.member_slug, r.candidate_name, r.support_or_oppose, r.amount, r.date, r.url, r.retrieved_at),
        ),
      );
    },

    async upsertLobbying(rows: LobbyingRow[]) {
      if (rows.length === 0) return;
      const filing = db.prepare(
        `INSERT INTO lobby_filing (id, registrant, client, amount, period, posted_date, url, retrieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           registrant = excluded.registrant, client = excluded.client, amount = excluded.amount,
           period = excluded.period, posted_date = excluded.posted_date, url = excluded.url,
           retrieved_at = excluded.retrieved_at`,
      );
      const issue = db.prepare('INSERT OR IGNORE INTO lobby_issue (filing_id, code) VALUES (?, ?)');
      await db.batch(
        rows.flatMap((r) => [
          filing.bind(r.id, r.registrant, r.client, r.amount, r.period, r.posted_date, r.url, r.retrieved_at),
          ...r.issue_codes.map((code) => issue.bind(r.id, code)),
        ]),
      );
    },

    async lobbyingFor(codes, sinceDay, limit) {
      const wanted = codes.slice(0, MAX_AREAS);
      if (wanted.length === 0) return [];
      const marks = wanted.map(() => '?').join(', ');
      const { results } = await db
        .prepare(
          `SELECT f.id, f.registrant, f.client, f.amount, f.period, f.posted_date, f.url,
                  (SELECT group_concat(code) FROM lobby_issue WHERE filing_id = f.id) AS codes
           FROM lobby_filing f
           WHERE f.posted_date >= ? AND f.id IN (SELECT filing_id FROM lobby_issue WHERE code IN (${marks}))
           ORDER BY f.posted_date DESC, f.id LIMIT ?`,
        )
        .bind(sinceDay, ...wanted, limit)
        .all<{ registrant: string; client: string; amount: number | null; period: string; posted_date: string; url: string; codes: string }>();
      return results.map(({ posted_date, codes: joined, ...rest }): LobbyFiling => ({
        registrant: rest.registrant,
        client: rest.client,
        issue_codes: joined.split(',').sort(),
        amount: rest.amount,
        period: rest.period,
        date: posted_date,
        url: rest.url,
      }));
    },

    async upsertMemberLinks(rows: MemberLink[]) {
      if (rows.length === 0) return;
      const statement = db.prepare(
        `INSERT INTO member_fec (member_slug, fec_candidate_id, chamber, state) VALUES (?, ?, ?, ?)
         ON CONFLICT(member_slug, fec_candidate_id) DO UPDATE SET chamber = excluded.chamber, state = excluded.state`,
      );
      await db.batch(rows.map((r) => statement.bind(r.member_slug, r.fec_candidate_id, r.chamber, r.state)));
    },

    async membersDueForSync(limit) {
      const { results } = await db
        .prepare(
          `SELECT member_slug, fec_candidate_id, chamber, state FROM member_fec
           ORDER BY synced_at IS NOT NULL, synced_at, member_slug LIMIT ?`,
        )
        .bind(limit)
        .all<MemberLink>();
      return results;
    },

    async markMemberSynced(link, at) {
      await db
        .prepare('UPDATE member_fec SET synced_at = ? WHERE member_slug = ? AND fec_candidate_id = ?')
        .bind(at, link.member_slug, link.fec_candidate_id)
        .run();
    },

    async distinctCommittees() {
      const { results } = await db
        .prepare('SELECT DISTINCT committee_id, committee_name FROM ie_spend ORDER BY committee_id')
        .all<{ committee_id: string; committee_name: string }>();
      return results;
    },

    async distinctTradeMembers() {
      const { results } = await db
        .prepare(
          `SELECT DISTINCT json_extract(j.value, '$.member_slug') AS slug
           FROM trade_cache, json_each(trade_cache.rows_json) AS j
           WHERE slug IS NOT NULL ORDER BY slug`,
        )
        .all<{ slug: string }>();
      return results.map((row) => row.slug);
    },

    async allMemberLinks() {
      const { results } = await db
        .prepare('SELECT member_slug, fec_candidate_id, chamber, state FROM member_fec ORDER BY member_slug')
        .all<MemberLink>();
      return results;
    },

    async getState(key) {
      const row = await db.prepare('SELECT value FROM sync_state WHERE key = ?').bind(key).first<{ value: string }>();
      return row?.value ?? null;
    },

    async setState(key, value) {
      await db
        .prepare('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(key, value)
        .run();
    },

    async getTradeCache(ticker) {
      const row = await db
        .prepare('SELECT fetched_at, rows_json FROM trade_cache WHERE ticker = ?')
        .bind(ticker)
        .first<{ fetched_at: number; rows_json: string }>();
      if (!row) return null;
      try {
        return { fetchedAt: row.fetched_at, rows: JSON.parse(row.rows_json) as BargoTrade[] };
      } catch {
        return null;
      }
    },

    async putTradeCache(ticker, entry) {
      await db
        .prepare(
          `INSERT INTO trade_cache (ticker, fetched_at, rows_json) VALUES (?, ?, ?)
           ON CONFLICT(ticker) DO UPDATE SET fetched_at = excluded.fetched_at, rows_json = excluded.rows_json`,
        )
        .bind(ticker, entry.fetchedAt, JSON.stringify(entry.rows))
        .run();
    },
  };
}
