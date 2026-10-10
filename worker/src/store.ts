import type { BargoTrade, RelatedBill } from '../../lib/types';
import type { BillRow } from './bills';
import type { Store } from './types';

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
