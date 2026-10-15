import { formatDate } from '@/lib/format';
import type { TickerContext } from '@/lib/types';

const dollars = (amount: number) => `$${amount.toLocaleString('en-US')}`;

/** True when there is anything to show, so callers can skip the section. */
export function hasInfluence(context: TickerContext | undefined): boolean {
  return (context?.tax_flags?.length ?? 0) > 0 || (context?.ie_spend?.length ?? 0) > 0;
}

/**
 * The Influence section: reviewed tax provisions and outside money. Every row
 * has the same fields and a link to the filing. It reports what was filed and
 * says nothing about why, votes or outcomes.
 */
export function InfluenceBody({ context }: { context: TickerContext }) {
  const flags = context.tax_flags ?? [];
  const spend = context.ie_spend ?? [];
  const billTitle = (id: string) => context.related_bills.find((bill) => bill.id === id)?.title ?? id;
  return (
    <details className="influence">
      <summary>Influence ({flags.length + spend.length})</summary>
      {flags.length > 0 && (
        <>
          <h3>Tax provisions in recent laws</h3>
          <ul className="influence-list">
            {flags.map((flag) => (
              <li key={`${flag.bill_id}|${flag.section_cite}`}>
                {flag.section_cite} in{' '}
                <a href={flag.url} target="_blank" rel="noopener noreferrer">
                  {billTitle(flag.bill_id)}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {spend.length > 0 && (
        <>
          <h3>Outside spending in members&apos; races</h3>
          <ul className="influence-list">
            {spend.map((row) => (
              <li key={`${row.committee_id}|${row.member_slug}|${row.date}|${row.amount}|${row.support_or_oppose}`}>
                {row.committee_name} reported {dollars(row.amount)} to {row.support_or_oppose} {row.candidate_name} on{' '}
                {formatDate(row.date)}.{' '}
                <a href={row.url} target="_blank" rel="noopener noreferrer">
                  FEC filing
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="notice">
        Filings show what was spent or passed, not why. They say nothing about votes or results. Not
        financial advice.
      </p>
    </details>
  );
}
