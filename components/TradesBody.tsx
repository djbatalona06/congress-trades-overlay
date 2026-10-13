import { BARGO_KEY_URL } from '@/lib/bargo';
import { formatDate } from '@/lib/format';
import type { TradesResponse } from '@/lib/types';
import { TradeRow } from './TradeRow';

/** The limit and saved-results notices plus the list, shared by the page panel and the pop-out. */
export function TradesBody({ response }: { response: TradesResponse }) {
  return (
    <>
      {response.status === 'limited' && (
        <p className="notice">
          Daily free limit reached. Get a{' '}
          <a href={BARGO_KEY_URL} target="_blank" rel="noopener noreferrer">
            free Bargo key
          </a>
          , then paste it in the Capitol Tape popup (Lookups tab) for more.
        </p>
      )}
      {response.stale && response.fetchedAt !== null && (
        <p className="notice">
          Saved results from {formatDate(new Date(response.fetchedAt).toISOString())}.
        </p>
      )}
      <ul className="trades">
        {response.trades.map((trade) => (
          <TradeRow key={trade.id} trade={trade} />
        ))}
      </ul>
    </>
  );
}
