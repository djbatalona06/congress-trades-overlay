import { fetchTrades } from '../../lib/bargo';
import type { Env } from './env';
import { syncBills, syncOrders } from './ingest';
import { handleRequest } from './routes';
import { d1Store } from './store';

/** Rows per ticker. Matches the extension, so the panel still says "5 recent". */
const ROWS_PER_TICKER = 5;

// Cron strings must match [triggers] in wrangler.toml.
const BILLS_CRON = '7 * * * *';
const ORDERS_CRON = '17 */6 * * *';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, {
      store: d1Store(env.DB),
      now: Date.now(),
      loadTrades: async (ticker) => {
        if (env.TRADE_SOURCE === 'none') return [];
        const result = await fetchTrades(ticker, { limit: ROWS_PER_TICKER, apiKey: env.BARGO_API_KEY });
        return result.trades;
      },
    });
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const store = d1Store(env.DB);
    const job =
      event.cron === BILLS_CRON
        ? syncBills(store, env.CONGRESS_API_KEY).then((r) => console.log('[bills]', JSON.stringify(r)))
        : event.cron === ORDERS_CRON
          ? syncOrders(store).then((r) => console.log('[orders]', JSON.stringify(r)))
          : Promise.resolve();
    // A failed run is logged and retried by the next tick; the stored data stays as it was.
    ctx.waitUntil(job.catch((error) => console.error('[cron] failed', event.cron, String(error))));
  },
} satisfies ExportedHandler<Env>;
