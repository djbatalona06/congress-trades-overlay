/**
 * Parsers for the Senate lobbying disclosure (LDA) API. Field names follow its docs and
 * are checked live by `npm run verify:influence`.
 */

export interface LobbyingRow {
  id: string;
  registrant: string;
  client: string;
  issue_codes: string[];
  amount: number | null;
  period: string;
  posted_date: string;
  url: string;
  retrieved_at: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

const PERIOD_LABEL: Record<string, string> = {
  first_quarter: 'Q1',
  second_quarter: 'Q2',
  third_quarter: 'Q3',
  fourth_quarter: 'Q4',
  mid_year: 'Mid-year',
  year_end: 'Year-end',
};

/** The official issue-code list: `[{ value: "DEF", name: "Defense" }, ...]` -> ["DEF", ...]. */
export function parseIssueCodes(body: unknown): string[] {
  const list = Array.isArray(body) ? body : (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const value = text((item as { value?: unknown } | null)?.value);
    return value ? [value] : [];
  });
}

/** One filing; null when it has no link, no posted day, or lists none of the issue codes in `wanted`. */
export function parseFiling(item: unknown, wanted: ReadonlySet<string>, retrievedAt: number): LobbyingRow | null {
  const f = item as Record<string, unknown> | null;
  if (!f || typeof f !== 'object') return null;

  const id = text(f.filing_uuid);
  const registrant = text((f.registrant as { name?: unknown } | null)?.name);
  const client = text((f.client as { name?: unknown } | null)?.name);
  const url = text(f.filing_document_url);
  const posted = text(f.dt_posted);
  if (!id || !registrant || !client || !url?.startsWith('https://') || !posted || !DAY.test(posted)) return null;

  const activities = Array.isArray(f.lobbying_activities) ? f.lobbying_activities : [];
  const codes = [
    ...new Set(
      activities.flatMap((a) => {
        const code = text((a as { general_issue_code?: unknown } | null)?.general_issue_code);
        return code && wanted.has(code) ? [code] : [];
      }),
    ),
  ];
  if (codes.length === 0) return null;

  // Lobbying firms report "income", companies lobbying for themselves report "expenses".
  const raw = Number(f.income ?? f.expenses);
  const period = text(f.filing_period);
  return {
    id,
    registrant,
    client,
    issue_codes: codes,
    amount: Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null,
    period: `${f.filing_year ?? ''} ${period ? (PERIOD_LABEL[period] ?? period) : ''}`.trim(),
    posted_date: posted.slice(0, 10),
    url,
    retrieved_at: retrievedAt,
  };
}
