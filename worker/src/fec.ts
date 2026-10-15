import type { IeSpend } from '../../lib/types';

/**
 * Parsers for openFEC answers. The field names follow the openFEC docs, but they have not
 * yet been checked against a live response from here; `npm run verify:influence` does that
 * and reports how many rows each parser dropped.
 */

export type IeSpendRow = IeSpend & { id: string; retrieved_at: number };

const DAY = /^\d{4}-\d{2}-\d{2}/;
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** One Schedule E (independent expenditure) row for a member; null when it cannot be shown with a link. */
export function parseIeRow(row: unknown, memberSlug: string, retrievedAt: number): IeSpendRow | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return null;

  const nested = r.committee as { name?: unknown } | null | undefined;
  const id = text(r.sub_id) ?? (typeof r.sub_id === 'number' ? String(r.sub_id) : null);
  const committeeId = text(r.committee_id);
  const committeeName = text(r.committee_name) ?? text(nested?.name);
  const candidateName = text(r.candidate_name);
  const url = text(r.pdf_url);
  const date = text(r.expenditure_date);
  const amount = r.expenditure_amount;
  const side = r.support_oppose_indicator === 'S' ? 'support' : r.support_oppose_indicator === 'O' ? 'oppose' : null;

  if (!id || !committeeId || !committeeName || !candidateName || !side) return null;
  if (!url?.startsWith('https://') || !date || !DAY.test(date)) return null;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    id,
    committee_id: committeeId,
    committee_name: committeeName,
    member_slug: memberSlug,
    candidate_name: candidateName,
    support_or_oppose: side,
    amount: Math.round(amount),
    date: date.slice(0, 10),
    url,
    retrieved_at: retrievedAt,
  };
}

export interface NamedId {
  id: string;
  name: string;
}

function firstResult(body: unknown): Record<string, unknown> | null {
  const results = (body as { results?: unknown } | null)?.results;
  const first = Array.isArray(results) ? results[0] : null;
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
}

/** `/candidate/{id}/` or `/committee/{id}/`: the id and name the FEC holds for it. */
export function parseNamedId(body: unknown, idField: 'candidate_id' | 'committee_id'): NamedId | null {
  const first = firstResult(body);
  const id = text(first?.[idField]);
  const name = text(first?.name);
  return id && name ? { id, name } : null;
}

/** Last name and first name compared the way the FEC writes them ("PELOSI, NANCY") against a plain name. */
export function sameName(a: string, b: string): boolean {
  const tokens = (value: string) =>
    value
      .toUpperCase()
      .replace(/[^A-Z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
  return tokens(a) === tokens(b);
}
