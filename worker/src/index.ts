import { fetchTrades } from '../../lib/bargo';
import { d1AccountStore } from './accounts-d1';
import { handleAuth } from './auth';
import type { Env } from './env';
import { syncBills, syncLobbying, syncMemberLinks, syncOrders, syncOutsideMoney } from './ingest';
import { handleRequest } from './routes';
import { d1Store } from './store';

/** Rows per ticker. Matches the extension, so the panel still says "5 recent". */
const ROWS_PER_TICKER = 5;

// Cron strings must match [triggers] in wrangler.toml.
const BILLS_CRON = '7 * * * *';
const ORDERS_CRON = '17 */6 * * *';
const MEMBERS_CRON = '47 4 * * *';
const OUTSIDE_MONEY_CRON = '37 * * * *';
const LOBBYING_CRON = '27 */6 * * *';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = await handleAuth(request, { store: d1AccountStore(env.DB), now: Date.now(), fetch, env });
    if (auth) return auth;
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
    const log = (name: string) => (result: unknown) => console.log(`[${name}]`, JSON.stringify(result));
    const jobs: Record<string, () => Promise<unknown>> = {
      [BILLS_CRON]: () => syncBills(store, env.CONGRESS_API_KEY).then(log('bills')),
      [ORDERS_CRON]: () => syncOrders(store).then(log('orders')),
      [MEMBERS_CRON]: () => syncMemberLinks(store).then(log('members')),
      // A missing key means the feature is not set up, not an error.
      [OUTSIDE_MONEY_CRON]: () => (env.FEC_API_KEY ? syncOutsideMoney(store, env.FEC_API_KEY).then(log('ie')) : Promise.resolve()),
      [LOBBYING_CRON]: () => syncLobbying(store, env.LDA_API_TOKEN).then(log('lobbying')),
    };
    const job = jobs[event.cron]?.() ?? Promise.resolve();
    // A failed run is logged and retried by the next tick; the stored data stays as it was.
    ctx.waitUntil(job.catch((error) => console.error('[cron] failed', event.cron, String(error))));
  },
} satisfies ExportedHandler<Env>;
