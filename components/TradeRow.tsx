import { PARTY_NAME, formatDate } from '@/lib/format';
import { TYPE_LABEL, officialRecordLinks } from '@/lib/trades';
import type { CongressTrade } from '@/lib/types';

export function TradeRow({ trade }: { trade: CongressTrade }) {
  const seat = [trade.chamber === 'senate' ? 'Senate' : trade.chamber && 'House', trade.state]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="trade">
      <div className="who">
        <span className="member">{trade.member}</span>
        {trade.party && (
          <span className={`party party-${trade.party}`} title={PARTY_NAME[trade.party]}>
            {trade.party}
          </span>
        )}
        {seat && <span className="seat">{seat}</span>}
      </div>
      <div className="what">
        <span className={`type type-${trade.type ?? 'unknown'}`}>
          {trade.type ? TYPE_LABEL[trade.type] : 'Trade'}
        </span>
        <span className="amount">{trade.amount}</span>
      </div>
      <div className="when">
        Filed {formatDate(trade.filedDate)} · Traded {formatDate(trade.transactionDate)}
        {officialRecordLinks(trade).map((link) => (
          <span key={link.url}>
            {' · '}
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          </span>
        ))}
      </div>
    </li>
  );
}
