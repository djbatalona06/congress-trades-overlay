import type { BargoTrade } from './types';

const BASE_URL = 'https://www.bargo.ai/free-apis/congress/v1';
export const BARGO_HOME = 'https://www.bargo.ai';

export type BargoErrorKind = 'rate_limited' | 'invalid_key' | 'network' | 'bad_response';

export class BargoError extends Error {
  constructor(
    readonly kind: BargoErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'BargoError';
  }
}

/** Rate-limit headers from one response. Null when a header was absent. */
export interface RateSnapshot {
  requestsLimit: number | null;
  requestsRemaining: number | null;
  rowsLimit: number | null;
  rowsRemaining: number | null;
}

export interface BargoResult {
  trades: BargoTrade[];
  rate: RateSnapshot;
}

function headerNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchTrades(
  ticker: string,
  options: { limit: number; apiKey?: string | null },
): Promise<BargoResult> {
  const url = `${BASE_URL}/trades/${encodeURIComponent(ticker)}?limit=${options.limit}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.apiKey) headers['X-Api-Key'] = options.apiKey;

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (cause) {
    throw new BargoError('network', `Could not reach Bargo: ${String(cause)}`);
  }

  if (response.status === 429) throw new BargoError('rate_limited', 'Daily Bargo limit reached');
  if (response.status === 401) throw new BargoError('invalid_key', 'Bargo rejected the API key');
  if (!response.ok) throw new BargoError('bad_response', `Bargo returned ${response.status}`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BargoError('bad_response', 'Bargo returned a non-JSON body');
  }
  const trades = (body as { trades?: unknown }).trades;
  if (!Array.isArray(trades)) throw new BargoError('bad_response', 'Bargo response had no trades');

  return {
    trades: trades as BargoTrade[],
    rate: {
      requestsLimit: headerNumber(response.headers, 'X-RateLimit-Limit'),
      requestsRemaining: headerNumber(response.headers, 'X-RateLimit-Remaining'),
      rowsLimit: headerNumber(response.headers, 'X-RateLimit-Rows-Limit'),
      rowsRemaining: headerNumber(response.headers, 'X-RateLimit-Rows-Remaining'),
    },
  };
}
