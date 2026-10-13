import { useEffect, useState } from 'react';
import { requestTrades } from '@/lib/messaging';
import type { TradesResponse } from '@/lib/types';

/** Asks the background for a ticker's trades; the answer is dropped if the ticker has changed. */
export function useTrades(ticker: string | null): TradesResponse | null {
  const [response, setResponse] = useState<TradesResponse | null>(null);

  useEffect(() => {
    setResponse(null);
    if (!ticker) return;
    let cancelled = false;
    // Rejects when the extension was reloaded under an open tab; the panel just stays hidden.
    requestTrades(ticker).then(
      (result) => !cancelled && setResponse(result),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return response?.ticker === ticker ? response : null;
}
