import type { ExecOrder, RelatedBill, TickerPayload } from './types';

export type WorkerErrorKind = 'network' | 'bad_response';

export class WorkerError extends Error {
  constructor(
    readonly kind: WorkerErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

const TIMEOUT_MS = 8000;

/**
 * Feature flag. The Worker is used only when the build sets
 * WXT_USE_WORKER=true and WXT_WORKER_URL to an https address; otherwise the
 * extension talks to Bargo exactly as before. Nothing secret is read here: the
 * Worker holds its own API keys.
 */
export function workerBaseUrl(): string | null {
  if (import.meta.env.WXT_USE_WORKER !== 'true') return null;
  const url = String(import.meta.env.WXT_WORKER_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  return url.startsWith('https://') ? url : null;
}

export function workerEnabled(): boolean {
  return workerBaseUrl() !== null;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isLink = (value: unknown): value is string => isText(value) && value.startsWith('https://');

function isBill(value: unknown): value is RelatedBill {
  const b = value as Partial<Record<keyof RelatedBill, unknown>> | null;
  return !!b && isText(b.id) && isText(b.title) && isText(b.status) && isText(b.date) && isText(b.policy_area) && isLink(b.url);
}

function isOrder(value: unknown): value is ExecOrder {
  const o = value as Partial<Record<keyof ExecOrder, unknown>> | null;
  return !!o && isText(o.document_number) && isText(o.title) && isText(o.publication_date) && isLink(o.url);
}

/** Asks the Worker for one ticker. Sends nothing but the ticker: no cookies, no headers, no key. */
export async function fetchTickerPayload(
  ticker: string,
  baseUrl: string | null = workerBaseUrl(),
): Promise<TickerPayload> {
  if (!baseUrl) throw new WorkerError('network', 'Worker is not enabled');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/ticker/${encodeURIComponent(ticker)}`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new WorkerError('network', `Could not reach the Worker: ${String(cause)}`);
  }
  if (!response.ok) throw new WorkerError('bad_response', `Worker returned ${response.status}`);

  let body: Partial<Record<keyof TickerPayload, unknown>> | null;
  try {
    body = await response.json();
  } catch {
    throw new WorkerError('bad_response', 'Worker returned a non-JSON body');
  }
  if (!body || !Array.isArray(body.trades)) throw new WorkerError('bad_response', 'Worker response had no trades');

  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    trades: body.trades as TickerPayload['trades'],
    related_bills: list(body.related_bills).filter(isBill),
    exec_orders: list(body.exec_orders).filter(isOrder),
  };
}
